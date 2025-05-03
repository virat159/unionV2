import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, UNION_CONTRACT, TOKENS } from './config.js';

const providerCache = new Map();

export const getProvider = (chainId) => {
  if (!providerCache.has(chainId)) {
    // Create network configuration
    const network = {
      name: chainId.toLowerCase(),
      chainId: Number(CHAINS[chainId])
    };

    // Initialize provider with explicit network
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chainId], network);
    
    // Verify connection
    provider.getBlockNumber().catch(error => {
      console.error(`Initial connection test failed for ${chainId}:`, error.message);
      throw error;
    });

    providerCache.set(chainId, provider);
  }
  return providerCache.get(chainId);
};

const getSafeAddress = (address) => {
  if (!address) return address;
  try {
    return ethers.getAddress(address);
  } catch {
    try {
      return ethers.getAddress(address.toLowerCase());
    } catch {
      return address; // For non-EVM addresses
    }
  }
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  const provider = getProvider(sourceChain);
  const wallet = new ethers.Wallet(privateKey, provider);

  // Get gas parameters
  const feeData = await provider.getFeeData();
  const gasParams = {
    maxFeePerGas: feeData.maxFeePerGas ?? ethers.parseUnits('50', 'gwei'),
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? ethers.parseUnits('2', 'gwei'),
    gasLimit: 300000
  };

  // Handle bridge address
  const bridgeAddress = getSafeAddress(UNION_CONTRACT[sourceChain]);
  if (!bridgeAddress) throw new Error(`Missing bridge address for ${sourceChain}`);

  // Handle native token transfer
  if (asset === 'native' || asset === 'NATIVE') {
    const tx = await wallet.sendTransaction({
      to: bridgeAddress,
      value: ethers.parseEther(amount.toString()),
      ...gasParams
    });
    return tx.hash;
  }

  // Handle ERC20 token transfer
  const tokenAddress = getSafeAddress(asset);
  const erc20 = new ethers.Contract(
    tokenAddress,
    ['function approve(address,uint256)', 'function transfer(address,uint256)'],
    wallet
  );

  // Approve if needed
  const allowance = await erc20.allowance(wallet.address, bridgeAddress);
  const parsedAmount = ethers.parseUnits(amount.toString(), await erc20.decimals());
  
  if (allowance < parsedAmount) {
    const approveTx = await erc20.approve(bridgeAddress, parsedAmount, gasParams);
    await approveTx.wait();
  }

  // Execute bridge transfer
  const bridge = new ethers.Contract(
    bridgeAddress,
    ['function depositERC20(address,uint256,uint16)'],
    wallet
  );

  const tx = await bridge.depositERC20(
    tokenAddress,
    parsedAmount,
    CHAINS[destChain],
    gasParams
  );

  return tx.hash;
};
