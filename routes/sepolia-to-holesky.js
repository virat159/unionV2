import { sendToken } from '../utils.js';
import { CHAINS, TOKENS, RPC_URLS } from '../config.js';
import pkg from 'prompt-sync';
const prompt = pkg({ sigint: true });
import { ethers } from 'ethers';

const transferWETH = async () => {
  try {
    // 1. Get private key securely
    const privateKey = prompt('Enter your Sepolia private key (hidden): ');

    // 2. Wrap ETH to WETH
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

    // 3. Bridge
