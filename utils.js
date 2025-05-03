import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, UNION_CONTRACT } from './config.js';

export const getProvider = (chainId) => {
  // Simplified provider configuration
  return new ethers.JsonRpcProvider(RPC_URLS[chainId]);
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  try {
    const provider = getProvider(sourceChain);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Validate chain IDs
    if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
      throw new Error(`Invalid chain: ${sourceChain} → ${destChain}`);
    }

    // Validate Union contract address
    if (!UNION_CONTRACT[sourceChain]) {
      throw new Error(`No Union contract for ${sourceChain}`);
    }

    // Native token transfer
    if (asset === 'native') {
      const tx = await wallet.sendTransaction({
        to: UNION_CONTRACT[sourceChain],
        value: ethers.parseEther(amount.toString())
      });
      return tx.hash;
    }

    // ERC20 token transfer
    const contract = new ethers.Contract(
      asset,
      ['function transfer(address to, uint256 amount) returns (bool)'],
      wallet
    );

    // Determine decimals
    const decimals = asset.includes('USDC') ? 6 : 18;
    const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

    const tx = await contract.transfer(
      UNION_CONTRACT[sourceChain],
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
    throw error; // Re-throw for caller to handle
  }
};
