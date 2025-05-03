import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, UNION_CONTRACT } from './config.js';

export const getProvider = (chainId) => {
  return new ethers.JsonRpcProvider(RPC_URLS[chainId]);
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  try {
    const provider = getProvider(sourceChain);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Validate and normalize Union contract address
    const unionAddress = UNION_CONTRACT[sourceChain].toLowerCase(); // Force lowercase
    if (!ethers.isAddress(unionAddress)) {
      throw new Error(`Invalid Union contract address for ${sourceChain}`);
    }

    // ERC20 token transfer
    const contract = new ethers.Contract(
      asset,
      ['function transfer(address to, uint256 amount) returns (bool)'],
      wallet
    );

    const decimals = asset.includes('USDC') ? 6 : 18;
    const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

    const tx = await contract.transfer(
      unionAddress,
      parsedAmount
    );

    return tx.hash;

  } catch (error) {
    console.error('Transaction failed:', {
      sourceChain,
      destChain,
      asset,
      amount,
      error: error.message
    });
    throw error;
  }
};
