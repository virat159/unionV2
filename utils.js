const { ethers } = require('ethers');
const { CHAINS, UNION_CONTRACT, RPC_URLS } = require('./config');

// Initialize provider and wallet
const getProvider = (chainId) => {
  const rpcUrl = RPC_URLS[chainId];
  return new ethers.JsonRpcProvider(rpcUrl);
};

// Generic token transfer function
const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  const provider = getProvider(sourceChain);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const unionContract = new ethers.Contract(
    UNION_CONTRACT[sourceChain],
    ['function transfer(uint16 destChainId, address asset, uint256 amount)'],
    wallet
  );

  const tx = await unionContract.transfer(
    CHAINS[destChain],
    asset,
    ethers.parseUnits(amount.toString(), 18) // Adjust decimals
  );
  
  return tx.hash;
};

module.exports = { getProvider, sendToken };
