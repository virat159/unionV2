import { sendToken } from '../utils.js';
import { CHAINS, TOKENS, RPC_URLS } from '../config.js';
import pkg from 'prompt-sync';
const prompt = pkg({ sigint: true });

const transferWETH = async () => {
  try {
    // 1. Get private key securely
    const privateKey = prompt('Enter your Sepolia private key (hidden): ');

    // 2. Bridge WETH
    console.log('⏳ Bridging WETH to Holesky...');
    const txHash = await sendToken({
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: 0.0001,
      privateKey: privateKey.trim()
    });

    console.log(`
    ✅ Successfully bridged 0.0001 WETH!
    Bridge TX: https://sepolia.etherscan.io/tx/${txHash}
    `);

  } catch (error) {
    console.error('❌ Detailed Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
};

transferWETH();
