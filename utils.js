import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, UNION_CONTRACT, TOKENS } from './config.js';

const providerCache = new Map();

export const getProvider = (chainId) => {
  if (!providerCache.has(chainId)) {
    providerCache.set(chainId, new ethers.JsonRpcProvider(RPC_URLS[chainId]));
  }
  return providerCache.get(chainId);
};

// Helper to safely get address
const getSafeAddress = (address) => {
  try {
    return ethers.getAddress(address.toLowerCase());
  } catch {
    return address.toLowerCase(); // Fallback to lowercase if checksum fails
  }
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  try {
    // Validate chains
    if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
      throw new Error(`Invalid chain: ${sourceChain} → ${destChain}`);
    }

    const provider = getProvider(sourceChain);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Get and validate bridge address
    const bridgeAddress = getSafeAddress(UNION_CONTRACT[sourceChain]);
    if (!bridgeAddress) {
      throw new Error(`Missing bridge address for ${sourceChain}`);
    }

    // Normalize token address
    const tokenAddress = getSafeAddress(asset);
    const isWETH = tokenAddress === getSafeAddress(TOKENS.WETH[sourceChain]);

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

      const [balance, allowance] = await Promise.all([
        erc20.balanceOf(wallet.address),
        erc20.allowance(wallet.address, bridgeAddress)
      ]);

      const parsedAmount = ethers.parseUnits(amount.toString(), 18);
      
      if (balance < parsedAmount) {
        throw new Error(`Insufficient WETH. Need ${amount}, has ${ethers.formatEther(balance)}`);
      }

      if (allowance < parsedAmount) {
        console.log('⏳ Approving WETH transfer...');
        const approveTx = await erc20.approve(bridgeAddress, parsedAmount);
        await approveTx.wait();
      }

      console.log('⏳ Bridging WETH...');
      const bridge = new ethers.Contract(
        bridgeAddress,
        ['function depositERC20(address token, uint256 amount, uint16 destChainId)'],
        wallet
      );

      const tx = await bridge.depositERC20(
        tokenAddress,
        parsedAmount,
        CHAINS[destChain],
        { gasLimit: 300000 }
      );

      return tx.hash;
    }

    // Handle other ERC20 tokens
    const contract = new ethers.Contract(
      tokenAddress,
      [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)'
      ],
      wallet
    );

    const decimals = await contract.decimals().catch(() => 18);
    const tx = await contract.transfer(
      bridgeAddress,
      ethers.parseUnits(amount.toString(), decimals)
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
