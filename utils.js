import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, UNION_CONTRACT } from './config.js';

export const getProvider = (chainId) => {
  return new ethers.JsonRpcProvider(RPC_URLS[chainId], {
    staticNetwork: true,
    timeout: 30000
  });
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  const provider = getProvider(sourceChain);
  const wallet = new ethers.Wallet(privateKey, provider);

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
    ['function transfer(address to, uint256 amount)'],
    wallet
  );
  
  const tx = await contract.transfer(
    UNION_CONTRACT[sourceChain],
    asset.includes('USDC') 
      ? ethers.parseUnits(amount.toString(), 6) // USDC decimals
      : ethers.parseUnits(amount.toString(), 18) // WETH decimals
  );
  
  return tx.hash;
};
