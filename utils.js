import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, RPC_FALLBACKS, UNION_CONTRACT, TOKENS, GAS_SETTINGS, RPC_TIMEOUTS } from './config.js';

const providerCache = new Map();

export const getProvider = async (chainId) => {  // Made async
  if (!providerCache.has(chainId)) {
    // First try primary RPC
    try {
      const network = {
        chainId: Number(CHAINS[chainId]),
        name: chainId.toLowerCase()
      };
      
      const primaryProvider = new ethers.JsonRpcProvider(
        RPC_URLS[chainId], 
        network,
        {
          staticNetwork: network,
          timeout: RPC_TIMEOUTS.connection
        }
      );
      
      // Verify connection with await
      await primaryProvider.getBlockNumber().catch(() => {
        throw new Error('Primary RPC failed');
      });
      
      providerCache.set(chainId, primaryProvider);
      return primaryProvider;
    } catch (primaryError) {
      console.warn(`Primary RPC failed for ${chainId}, trying fallbacks...`);
      
      // Try fallback RPCs
      const fallbacks = RPC_FALLBACKS[chainId] || [];
      for (const url of fallbacks) {
        try {
          const network = {
            chainId: Number(CHAINS[chainId]),
            name: chainId.toLowerCase()
          };
          
          const fallbackProvider = new ethers.JsonRpcProvider(
            url,
            network,
            {
              staticNetwork: network,
              timeout: RPC_TIMEOUTS.connection
            }
          );
          
          // Verify connection with await
          await fallbackProvider.getBlockNumber();
          
          providerCache.set(chainId, fallbackProvider);
          return fallbackProvider;
        } catch (fallbackError) {
          console.warn(`Fallback RPC ${url} failed:`, fallbackError.message);
          continue;
        }
      }
      
      throw new Error(`No working RPC providers for ${chainId}`);
    }
  }
  return providerCache.get(chainId);
};

const getSafeAddress = (address) => {
  if (!address) return address;
  if (typeof address !== 'string') return address;
  
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

const getGasParams = async (provider) => {
  try {
    const feeData = await provider.getFeeData();
    return {
      maxFeePerGas: feeData.maxFeePerGas?.mul(Math.floor(GAS_SETTINGS.maxFeeMultiplier * 100)).div(100) 
        ?? ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(Math.floor(GAS_SETTINGS.maxPriorityFeeMultiplier * 100)).div(100)
        ?? ethers.parseUnits('2', 'gwei'),
      gasLimit: GAS_SETTINGS.defaultGasLimit
    };
  } catch (error) {
    console.warn('Failed to get fee data, using defaults:', error);
    return {
      maxFeePerGas: ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      gasLimit: GAS_SETTINGS.defaultGasLimit
    };
  }
};

const withRetry = async (fn, retries = 3, delay = GAS_SETTINGS.retryDelay) => {
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
      if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
        throw new Error(`Invalid chain: ${sourceChain} → ${destChain}`);
      }

      const provider = await getProvider(sourceChain);  // Added await here
      const wallet = new ethers.Wallet(privateKey, provider);
      const gasParams = await getGasParams(provider);

      const bridgeAddress = UNION_CONTRACT[sourceChain];
      if (!bridgeAddress || bridgeAddress.startsWith('0x000')) {
        throw new Error(`Missing bridge address for ${sourceChain}`);
      }
      const safeBridgeAddress = getSafeAddress(bridgeAddress);

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

      const tokenAddress = getSafeAddress(asset);
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

      const balance = await withRetry(() => erc20.balanceOf(wallet.address));
      if (balance < parsedAmount) {
        throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
      }

      const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress));
      if (allowance < parsedAmount) {
        console.log('⏳ Approving token transfer...');
        const approveTx = await withRetry(() => 
          erc20.approve(safeBridgeAddress, parsedAmount, gasParams)
        );
        await withRetry(() => approveTx.wait());
      }

      console.log(`⏳ Bridging to ${destChain}...`);
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
