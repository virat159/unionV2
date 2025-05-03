import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, UNION_CONTRACT, TOKENS } from './config.js';

const providerCache = new Map();

export const getProvider = (chainId) => {
  if (!providerCache.has(chainId)) {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId]);
    providerCache.set(chainId, provider);
  }
  return providerCache.get(chainId);
};

// Improved address validation
const getSafeAddress = (address) => {
  if (!address) return address;
  
  try {
    // First try direct checksum
    return ethers.getAddress(address);
  } catch {
    try {
      // Try lowercase if first attempt fails
      return ethers.getAddress(address.toLowerCase());
    } catch {
      // Return raw for non-EVM addresses (like Xion)
      return address;
    }
  }
};

// Enhanced gas estimation
const getGasParams = async (provider) => {
  const feeData = await provider.getFeeData();
  return {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    gasLimit: 300000 // Base limit, adjust per chain
  };
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
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
    if (!bridgeAddress || bridgeAddress === '0x000...') {
      throw new Error(`Missing or invalid bridge address for ${sourceChain}`);
    }
    const safeBridgeAddress = getSafeAddress(bridgeAddress);

    // Handle native ETH transfers
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

    // Handle token transfers (WETH or other ERC20)
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

    const decimals = await erc20.decimals().catch(() => 18);
    const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

    // Check balance
    const balance = await erc20.balanceOf(wallet.address);
    if (balance < parsedAmount) {
      throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
    }

    // Check and approve if needed
    const allowance = await erc20.allowance(wallet.address, safeBridgeAddress);
    if (allowance < parsedAmount) {
      console.log('⏳ Approving token transfer...');
      const approveTx = await erc20.approve(safeBridgeAddress, parsedAmount, gasParams);
      await approveTx.wait();
    }

    // Different bridge functions for WETH vs other tokens
    const bridge = new ethers.Contract(
      safeBridgeAddress,
      [
        'function depositERC20(address token, uint256 amount, uint16 destChainId)',
        'function depositNative(uint16 destChainId) payable'
      ],
      wallet
    );

    console.log(`⏳ Bridging ${isWETH ? 'WETH' : 'ERC20'} to ${destChain}...`);
    const tx = await bridge.depositERC20(
      tokenAddress,
      parsedAmount,
      CHAINS[destChain],
      gasParams
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
};
