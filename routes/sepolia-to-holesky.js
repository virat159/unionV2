import { sendToken } from '../utils.js';
import { TOKENS } from '../config.js';
import pkg from 'prompt-sync';
const prompt = pkg({ sigint: true });

const transferWETH = async () => {
  try {
    const privateKey = prompt('Enter your Sepolia private key (hidden): ');
    
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
    console.error('❌ Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
};

transferWETH();
