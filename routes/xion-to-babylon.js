const { sendToken } = require('../utils');
const { CHAINS } = require('../config');

const XION_TO_BABYLON = {
  sourceChain: 'XION',
  destChain: 'BABYLON',
  asset: 'uxion', // Xion native token
  amount: 10,
  privateKey: process.env.PRIVATE_KEY // From GitHub Secrets
};

sendToken(XION_TO_BABYLON)
  .then(txHash => console.log(`✅ XION → Babylon TX: ${txHash}`))
  .catch(console.error);
