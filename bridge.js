import { sendToken } from './utils.js';
import dotenv from 'dotenv';
dotenv.config();

const main = async () => {
  const result = await sendToken({
    sourceChain: 'SEPOLIA',
    destChain: 'HOLESKY',
    asset: 'USDC',
    amount: '0.001', // send 0.001 USDC
    privateKey: process.env.PRIVATE_KEY
  });

  console.log('Bridge Tx Hash:', result);
};

main().catch(console.error);
