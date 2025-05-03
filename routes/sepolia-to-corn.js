import { sendToken } from '../utils.js';
import { CHAINS, TOKEN_ADDRESSES } from '../config.js';
import prompt from 'prompt-sync';
import { ethers } from 'ethers';

const transferWETH = async () => {
  try {
    // 1. Get user input
    const getKey = prompt({ sigint: true });
    const privateKey = getKey('Enter your private key (hidden): ');

    // 2. Set up transfer parameters
    const txParams = {
      sourceChain: 'SEPOLIA',
      destChain: 'CORN',
      asset: TOKEN_ADDRESSES.SEPOLIA_WETH,
      amount: 0.01, // Amount of WETH to send
      privateKey: privateKey.trim()
    };

    // 3. Execute transfer
    console.log('⏳ Initiating WETH transfer from Sepolia to Corn...');
    const txHash = await sendToken(txParams);
    console.log(`✅ Success! TX Hash: ${txHash}`);
    
    // 4. Explorer links
    console.log(`
    Sepolia Explorer: https://sepolia.etherscan.io/tx/${txHash}
    Corn Explorer:    https://explorer.corn/testnet/tx/${txHash}
    `);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

transferWETH();
