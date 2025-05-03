import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, UNION_CONTRACT, TOKENS } from './config.js';

export const getProvider = (chainId) => {
  return new ethers.JsonRpcProvider(RPC_URLS[chainId]);
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
  try {
    const provider = getProvider(sourceChain);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Validate addresses
    const bridgeAddress = UNION_CONTRACT[sourceChain];
    if (!ethers.isAddress(bridgeAddress)) {
      throw new Error(`Invalid bridge address for ${sourceChain}`);
    }

    // For WETH transfers, use the bridge's depositERC20 function
    if (asset === TOKENS.WETH[sourceChain]) {
      const erc20 = new ethers.Contract(
        asset,
        [
          'function approve(address spender, uint256 amount) returns (bool)',
          'function balanceOf(address owner) view returns (uint256)'
        ],
        wallet
      );

      // 1. Check balance
      const balance = await erc20.balanceOf(wallet.address);
      const parsedAmount = ethers.parseUnits(amount.toString(), 18);
      
      if (balance < parsedAmount) {
        throw new Error(`Insufficient WETH balance. Needed: ${amount}, Has: ${ethers.formatEther(balance)}`);
      }

      // 2. Approve bridge to spend WETH
      console.log('⏳ Approving WETH transfer...');
      const approveTx = await erc20.approve(bridgeAddress, parsedAmount);
      await approveTx.wait();

      // 3. Execute bridge transfer
      const bridge = new ethers.Contract(
        bridgeAddress,
        [
          'function depositERC20(address token, uint256 amount, uint16 destChainId)'
        ],
        wallet
      );

      console.log('⏳ Bridging WETH...');
      const tx = await bridge.depositERC20(
        asset,
        parsedAmount,
        CHAINS[destChain]
      );

      return tx.hash;
    }

    // Standard ERC20 transfer (for non-WETH tokens)
    const contract = new ethers.Contract(
      asset,
      ['function transfer(address to, uint256 amount) returns (bool)'],
      wallet
    );

    const decimals = asset.includes('USDC') ? 6 : 18;
    const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

    const tx = await contract.transfer(bridgeAddress, parsedAmount);
    return tx.hash;

  } catch (error) {
    console.error('Transaction failed:', {
      sourceChain,
      destChain,
      asset,
      amount,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};
