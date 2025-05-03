import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, UNION_CONTRACT, TOKENS } from './config.js';

// Cache providers for better performance
const providerCache = new Map();

export const getProvider = (chainId) => {
  if (!providerCache.has(chainId)) {
    providerCache.set(chainId, new ethers.JsonRpcProvider(RPC_URLS[chainId]));
  }
  return providerCache.get(chainId);
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  try {
    // Validate input parameters
    if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
      throw new Error(`Invalid chain specified: ${sourceChain} → ${destChain}`);
    }

    const provider = getProvider(sourceChain);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Normalize and validate bridge address
    const bridgeAddress = ethers.getAddress(UNION_CONTRACT[sourceChain]);
    if (!bridgeAddress) {
      throw new Error(`Missing bridge address for ${sourceChain}`);
    }

    // Normalize token address
    const tokenAddress = ethers.getAddress(asset);
    const isWETH = tokenAddress === ethers.getAddress(TOKENS.WETH[sourceChain]);

    // For WETH transfers
    if (isWETH) {
      const erc20 = new ethers.Contract(
        tokenAddress,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function balanceOf(address owner) view returns (uint256)',
          'function allowance(address owner, address spender) view returns (uint256)'
        ],
        wallet
      );

      // Check balance and existing allowance
      const [balance, allowance] = await Promise.all([
        erc20.balanceOf(wallet.address),
        erc20.allowance(wallet.address, bridgeAddress)
      ]);

      const parsedAmount = ethers.parseUnits(amount.toString(), 18);
      
      if (balance < parsedAmount) {
        throw new Error(`Insufficient WETH. Need ${amount}, has ${ethers.formatEther(balance)}`);
      }

      // Only approve if needed
      if (allowance < parsedAmount) {
        console.log('⏳ Approving WETH transfer...');
        const approveTx = await erc20.approve(bridgeAddress, parsedAmount);
        await approveTx.wait();
      }

      // Execute bridge transfer with retry logic
      const bridge = new ethers.Contract(
        bridgeAddress,
        [
          'function depositERC20(address token, uint256 amount, uint16 destChainId)'
        ],
        wallet
      );

      console.log('⏳ Bridging WETH...');
      const tx = await bridge.depositERC20(
        tokenAddress,
        parsedAmount,
        CHAINS[destChain],
        { gasLimit: 300000 } // Increased gas limit
      );

      console.log(`ℹ️ Gas used: ${tx.gasLimit.toString()}`);
      return tx.hash;
    }

    // For other ERC20 tokens
    const contract = new ethers.Contract(
      tokenAddress,
      [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)'
      ],
      wallet
    );

    // Dynamic decimals detection
    let decimals = 18;
    try {
      decimals = await contract.decimals();
    } catch (e) {
      console.log('⚠️ Using default decimals (18)');
    }

    const parsedAmount = ethers.parseUnits(amount.toString(), decimals);
    const tx = await contract.transfer(bridgeAddress, parsedAmount);
    
    return tx.hash;

  } catch (error) {
    console.error('❌ Transaction failed:', {
      sourceChain,
      destChain,
      asset,
      amount,
      reason: error.reason || error.message,
      code: error.code,
      method: error.method,
      stack: error.stack
    });
    throw error;
  }
};
