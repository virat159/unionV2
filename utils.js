import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, RPC_FALLBACKS, UNION_CONTRACT, TOKENS, GAS_SETTINGS, RPC_TIMEOUTS } from './config.js';

const providerCache = new Map();

export const getProvider = async (chainId) => {
  if (!providerCache.has(chainId)) {
    // Combine all RPC endpoints (primary + fallbacks)
    const endpoints = [
      RPC_URLS[chainId],
      ...(RPC_FALLBACKS[chainId] || [])
    ].filter(Boolean);

    for (const url of endpoints) {
      try {
        const provider = new ethers.JsonRpcProvider(url, {
          chainId: Number(CHAINS[chainId]),
          name: chainId.toLowerCase(),
          timeout: RPC_TIMEOUTS.connection
        });

        // Verify connection works
        await provider.getBlockNumber();
        providerCache.set(chainId, provider);
        return provider;
      } catch (error) {
        console.warn(`RPC endpoint failed (${url}):`, error.message);
        continue;
      }
    }
    throw new Error(`All RPC endpoints failed for ${chainId}`);
  }
  return providerCache.get(chainId);
};

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

const getGasParams = async (provider) => {
  try {
    const feeData = await provider
