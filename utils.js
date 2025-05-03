import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, UNION_CONTRACT, TOKENS } from './config.js';

const providerCache = new Map();

export const getProvider = (chainId) => {
  if (!providerCache.has(chainId)) {
    const rpcUrls = Array.isArray(RPC_URLS[chainId]) ? RPC_URLS[chainId] : [RPC_URLS[chainId]];
    
    // Create network configuration
    const network = {
      chainId: CHAINS[chainId],
      name: chainId.toLowerCase().replace(/-/g, '_')
    };

    // Create provider instances
    const providers = rpcUrls.map(url => {
      try {
        return new ethers.JsonRpcProvider(url, network, {
          staticNetwork: network,
          batchStallTime: 100,
          batchMaxCount: 1
        });
      } catch (error) {
        console.error(`Failed to create provider for ${url}:`, error);
        return null;
      }
    }).filter(Boolean);

    if (providers.length === 0) {
      throw new Error(`No valid RPC providers available for ${chainId}`);
    }

    const provider = providers.length === 1 
      ? providers[0] 
      : new ethers.FallbackProvider(providers, 1); // Quorum of 1

    providerCache.set(chainId, provider);
  }
  return providerCache.get(chainId);
};

// Enhanced address validation
const getSafeAddress = (address) => {
  if (!address) return address;
  if (typeof address !== 'string') return address;
  
  // Skip validation for non-EVM addresses (Xion format)
  if (address.startsWith('xion')) return address;

  try {
    return ethers.getAddress(address);
  } catch {
    try {
      return ethers.getAddress(address.toLowerCase());
    } catch {
      console.warn(`Could not checksum address: ${address}, using raw`);
      return address;
    }
  }
};

// Improved gas estimation with fallbacks
const getGasParams = async (provider) => {
  try {
    const feeData = await provider.getFeeData();
    return {
      maxFeePerGas: feeData.maxFeePerGas ?? ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? ethers.parseUnits('2', 'gwei'),
      gasLimit: 350000 // Slightly higher default limit
    };
  } catch (error) {
    console.warn('Failed to get fee data, using defaults:', error);
    return {
      maxFeePerGas: ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      gasLimit: 350000
    };
  }
};

// Transaction retry wrapper
const withRetry = async (fn, retries = 3, delay = 2000) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  return withRetry(async () => {
    try {
      // Validate chains
      if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
        throw new Error(`Invalid chain: ${sourceChain} → ${destChain}`);
      }

      const provider = getProvider(sourceChain);
      const wallet = new ethers.Wallet(privateKey, provider);
      const gasParams = await getGasParams(provider);

      // Get bridge address with better validation
      const bridgeAddress = UNION_CONTRACT[sourceChain];
      if (!bridgeAddress || bridgeAddress.startsWith('0x000')) {
        throw new Error(`Missing or invalid bridge address for ${sourceChain}`);
      }
      const safeBridgeAddress = getSafeAddress(bridgeAddress);

      // Handle native transfers
      const isNative = asset === 'native' || asset === 'NATIVE';
      if (isNative) {
        const bridge = new ethers.Contract(
          safeBridgeAddress,
          ['function depositNative(uint16 destChainId) payable'],
          wallet
        );
        
        const tx = await bridge.depositNative(
          CHAINS[destChain],
          {
            value: ethers.parseEther(amount.toString()),
            ...gasParams
          }
        );
        return tx.hash;
      }

      // Handle token transfers
      const tokenAddress = getSafeAddress(asset);
      const isWETH = tokenAddress === getSafeAddress(TOKENS.WETH?.[sourceChain]);

      const erc20 = new ethers.Contract(
        tokenAddress,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function balanceOf(address owner) view returns (uint256)',
          'function allowance(address owner, address spender) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ],
        wallet
      );

      const decimals = await withRetry(() => erc20.decimals().catch(() => 18));
      const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

      // Check balance
      const balance = await withRetry(() => erc20.balanceOf(wallet.address));
      if (balance < parsedAmount) {
        throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
      }

      // Check and approve if needed
      const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress));
      if (allowance < parsedAmount) {
        console.log('⏳ Approving token transfer...');
        const approveTx = await withRetry(() => 
          erc20.approve(safeBridgeAddress, parsedAmount, gasParams)
        );
        await withRetry(() => approveTx.wait());
      }

      console.log(`⏳ Bridging ${isWETH ? 'WETH' : 'ERC20'} to ${destChain}...`);
      const bridge = new ethers.Contract(
        safeBridgeAddress,
        [
          'function depositERC20(address token, uint256 amount, uint16 destChainId)',
          'function depositNative(uint16 destChainId) payable'
        ],
        wallet
      );

      const tx = await withRetry(() => 
        bridge.depositERC20(
          tokenAddress,
          parsedAmount,
          CHAINS[destChain],
          gasParams
        )
      );

      return tx.hash;

    } catch (error) {
      console.error('❌ Transaction failed:', {
        sourceChain,
        destChain,
        asset,
        amount,
        reason: error.reason || error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  });
};
