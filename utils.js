import { ethers } from 'ethers';
import { CHAINS, UNION_CONTRACT, RPC_URLS } from './config.js'; // Note .js extension

// Initialize provider and wallet
export const getProvider = (chainId) => {
  const rpcUrl = RPC_URLS[chainId];
  return new ethers.JsonRpcProvider(rpcUrl);
};

// Generic token transfer function
export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  const provider = getProvider(sourceChain);
  const wallet = new ethers.Wallet(privateKey, provider);
