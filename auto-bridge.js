import { sendToken } from './utils.js';
import { CHAINS, TOKENS } from './config.js';

const TRANSACTION_GROUPS = [
  // Sepolia Group (20 tx)
  { from: 'SEPOLIA', to: 'BABYLON', token: 'WETH', count: 5 },
  { from: 'SEPOLIA', to: 'BABYLON', token: 'USDC', count: 5 },
  { from: 'SEPOLIA', to: 'HOLESKY', token: 'WETH', count: 5 },
  { from: 'SEPOLIA', to: 'HOLESKY', token: 'USDC', count: 5 },

  // Xion Group (20 tx)
  { from: 'XION', to: 'HOLESKY', token: 'NATIVE', count: 5 },
  { from: 'XION', to: 'HOLESKY', token: 'USDC', count: 5 },
  { from: 'XION', to: 'BABYLON', token: 'NATIVE', count: 5 },
  { from: 'XION', to: 'BABYLON', token: 'USDC', count: 5 },

  // Babylon Group (30 tx)
  { from: 'BABYLON', to: 'XION', token: 'NATIVE', count: 5 },
  { from: 'BABYLON', to: 'XION', token: 'USDC', count: 5 },
  { from: 'BABYLON', to: 'SEPOLIA', token: 'NATIVE', count: 5 },
  { from: 'BABYLON', to: 'SEPOLIA', token: 'USDC', count: 5 },
  { from: 'BABYLON', to: 'HOLESKY', token: 'NATIVE', count: 5 },
  { from: 'BABYLON', to: 'HOLESKY', token: 'USDC', count: 5 }
];

async function executeTransactions() {
  for (const group of TRANSACTION_GROUPS) {
    for (let i = 0; i < group.count; i++) {
      try {
        const asset = group.token === 'NATIVE' ? 
          'native' : TOKENS[group.token][group.from];
        
        const txHash = await sendToken({
          sourceChain: group.from,
          destChain: group.to,
          asset: asset,
          amount: group.token === 'USDC' ? 10 : 0.1, // Adjust amounts
          privateKey: process.env.PRIVATE_KEY
        });

        console.log(`✅ ${group.from}→${group.to} ${group.token} #${i+1}: ${txHash}`);
        await new Promise(resolve => setTimeout(resolve, 15000)); // 15s delay
      } catch (error) {
        console.error(`❌ Failed ${group.from}→${group.to}:`, error.message);
      }
    }
  }
}

executeTransactions();
