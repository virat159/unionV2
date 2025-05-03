import { sendToken } from '../utils.js';
import { CHAINS, TOKENS, RPC_URLS } from '../config.js';
import pkg from 'prompt-sync';
const prompt = pkg({ sigint: true });
import { ethers } from 'ethers';

const transferWETH = async () => {
  try {
    // 1. Get private key securely
    const privateKey = prompt('Enter your Sepolia private key (hidden): ');

    // 2. Directly bridge WETH (no wrapping)
    console.log('⏳ Bridging WETH to Holesky...');
    const txHash = await sendToken({
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: 0.0001, // WETH amount to bridge
      privateKey: privateKey.trim()
    });

    console.log(`
    ✅ Successfully bridged 0.0001 WETH!
    Bridge TX: https://sepolia.etherscan.io/tx/${txHash}
    `);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

transferWETH();
