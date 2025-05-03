import { sendToken } from './utils.js';
import { CHAINS, TOKENS } from './config.js';
import schedule from 'node-schedule';

const TRANSACTION_GROUPS = [
  // Sepolia Transactions (20)
  { from: 'SEPOLIA', to: 'BABYLON', token: 'WETH', count: 5, amount: 0.1 },
  { from: 'SEPOLIA', to: 'BABYLON', token: 'USDC', count: 5, amount: 10 },
  { from: 'SEPOLIA', to: 'HOLESKY', token: 'WETH', count: 5, amount: 0.1 },
  { from: 'SEPOLIA', to: 'HOLESKY', token: 'USDC', count: 5, amount: 10 },

  // Xion Transactions (20)
  { from: 'XION', to: 'HOLESKY', token: 'NATIVE', count: 5, amount: 10 },
  { from: 'XION', to: 'HOLESKY', token: 'USDC', count: 5, amount: 10 },
  { from: 'XION', to: 'BABYLON', token: 'NATIVE', count: 5, amount: 10 },
  { from: 'XION', to: 'BABYLON', token: 'USDC', count: 5, amount: 10 },

  // Babylon Transactions (30)
  { from: 'BABYLON', to: 'XION', token: 'NATIVE', count: 5, amount: 10 },
  { from: 'BABYLON', to: 'XION', token: 'USDC', count: 5, amount: 10 },
  { from: 'BABYLON', to: 'SEPOLIA', token: 'NATIVE', count: 5, amount: 0.1 },
  { from: 'BABYLON', to: 'SEPOLIA', token: 'USDC', count: 5, amount: 10 },
  { from: 'BABYLON', to: 'HOLESKY', token: 'NATIVE', count: 5, amount: 0.1 },
  { from: 'BABYLON', to: 'HOLESKY', token: 'USDC', count: 5, amount: 10 }
];

async function executeGroup(group) {
  const results = [];
  for (let i = 0; i < group.count; i++) {
    try {
      const asset = group.token === 'NATIVE' 
        ? 'native' 
        : TOKENS[group.token][group.from];

      const txHash = await sendToken({
        sourceChain: group.from,
        destChain: group.to,
        asset,
        amount: group.amount,
        privateKey: process.env.PRIVATE_KEY
      });

      results.push(`✅ ${group.from}→${group.to} ${group.token} #${i+1}: ${txHash}`);
      await new Promise(resolve => setTimeout(resolve, 15000)); // Rate limiting
    } catch (error) {
      results.push(`❌ Failed ${group.from}→${group.to}: ${error.message}`);
    }
  }
  return results;
}

// Main execution
async function main() {
  for (const group of TRANSACTION_GROUPS) {
    const results = await executeGroup(group);
    console.log(results.join('\n'));
  }
}

// Schedule daily at midnight UTC
schedule.scheduleJob('0 0 * * *', main);

// Immediate test run
main().catch(console.error);
