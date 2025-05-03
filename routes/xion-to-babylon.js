import { sendToken } from '../utils.js'; // Note .js extension
import { CHAINS } from '../config.js';

// Prompt for private key (if not using .env)
import prompt from 'prompt-sync';
const getKey = prompt({ sigint: true });
const privateKey = getKey('Enter your private key (hidden): ');

const XION_TO_BABYLON = {
  sourceChain: 'XION',
  destChain: 'BABYLON',
  asset: 'uxion',
  amount: 10,
  privateKey: privateKey
};

sendToken(XION_TO_BABYLON)
  .then(txHash => console.log(`✅ TX Hash: ${txHash}`))
  .catch(console.error);
