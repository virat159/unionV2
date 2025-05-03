import { sendToken } from '../utils.js';
import { CHAINS, TOKENS } from '../config.js';
import prompt from 'prompt-sync';
import { ethers } from 'ethers';

const transferWETH = async () => {
  try {
    // 1. Get private key securely
    const getKey = prompt({ sigint: true });
    const privateKey = getKey('Enter your Sepolia private key (hidden): ');

    // 2. Wrap ETH to WETH if needed (optional)
    const provider = new ethers.JsonRpcProvider(RPC_URLS.SEPOLIA);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const weth = new ethers.Contract(
      TOKENS.WETH.SEPOLIA,
      ['function deposit() payable'],
      wallet
    );
    
    console.log('⏳ Wrapping ETH to WETH...');
    const wrapTx = await weth.deposit({ 
      value: ethers.parseEther('0.1') // Wrap 0.1 ETH
    });
    await wrapTx.wait();

    // 3. Bridge WETH
    console.log('⏳ Bridging WETH to Holesky...');
    const txHash = await sendToken({
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: 0.1, // WETH amount
      privateKey: privateKey.trim()
    });

    console.log(`
    ✅ Successfully bridged!
    Wrapping TX: https://sepolia.etherscan.io/tx/${wrapTx.hash}
    Bridge TX: https://sepolia.etherscan.io/tx/${txHash}
    `);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

transferWETH();
