const { sendToken } = require('../utils');
const { CHAINS } = require('../config');
const prompt = require('prompt-sync')(); // Import prompt

// Ask for private key securely
const privateKey = prompt('Enter your testnet private key (will not echo): ', {
  echo: '*' // Mask input
});

const XION_TO_BABYLON = {
  sourceChain: 'XION',
  destChain: 'BABYLON',
  asset: 'uxion',
  amount: 10,
  privateKey: privateKey // Use prompted key
};

sendToken(XION_TO_BABYLON)
  .then(txHash => console.log(`✅ XION → Babylon TX: ${txHash}`))
  .catch(console.error);
