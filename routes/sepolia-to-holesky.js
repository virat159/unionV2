import { ethers } from 'ethers';
import { sendToken } from '../utils.js';
import { CHAINS, TOKENS, UNION_CONTRACT } from '../config.js';
import pkg from 'prompt-sync';
import chalk from 'chalk';
const prompt = pkg({ sigint: true });

const transferWETH = async () => {
  try {
    console.log(chalk.blue('\n🔗 Sepolia to Holesky WETH Bridge\n'));
    
    // Get user input with validation
    const privateKey = prompt('Enter your Sepolia private key (hidden): ', { echo: '*' });
    if (!privateKey || !privateKey.trim()) {
      throw new Error('No private key provided');
    }

    const amount = 0.0001;
    
    console.log(chalk.yellow('\n⏳ Checking bridge status...'));
    console.log(chalk.gray(`Bridge Address: ${UNION_CONTRACT.SEPOLIA}`));

    // Enhanced transaction parameters with higher gas settings
    const txParams = {
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: amount,
      privateKey: privateKey.trim(),
      gasSettings: {
        maxFeePerGas: ethers.parseUnits("20", "gwei"),  // Increased significantly
        maxPriorityFeePerGas: ethers.parseUnits("15", "gwei"), // Increased significantly
        gasLimit: 500000  // Increased from 350000
      }
    };

    console.log(chalk.yellow('\n⏳ Initiating bridge transfer...'));
    console.log(chalk.gray(`- Amount: ${amount} WETH`));
    
    // Enhanced gas parameters logging
    console.log(chalk.gray('- Gas Parameters:'));
    console.log(chalk.gray(`  Max Fee: ${ethers.formatUnits(txParams.gasSettings.maxFeePerGas, "gwei")} Gwei`));
    console.log(chalk.gray(`  Priority Fee: ${ethers.formatUnits(txParams.gasSettings.maxPriorityFeePerGas, "gwei")} Gwei`));
    console.log(chalk.gray(`  Gas Limit: ${txParams.gasSettings.gasLimit.toString()}`));

    // Add retry logic for the transaction
    let txHash;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(chalk.yellow(`\n⏳ Attempt ${attempts}/${maxAttempts}`));
        txHash = await sendToken(txParams);
        break;
      } catch (error) {
        if (attempts === maxAttempts) throw error;
        console.log(chalk.yellow(`⚠️ Attempt failed, retrying... (${error.message})`));
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
      }
    }

    console.log(chalk.green(`
    ✅ Transaction submitted successfully!
    Transaction Hash: ${chalk.underline(`https://sepolia.etherscan.io/tx/${txHash}`)}
    `));
    
    console.log(chalk.yellow('\n⏳ Waiting for completion on Holesky...'));
    console.log(chalk.gray('This may take 2-5 minutes...'));

    // Add receipt polling with timeout
    const provider = new ethers.JsonRpcProvider(CHAINS.SEPOLIA.rpcUrl);
    let receipt;
    const startTime = Date.now();
    const timeout = 120000; // 2 minutes timeout
    
    while (!receipt && Date.now() - startTime < timeout) {
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
          continue;
        }
        
        if (receipt.status === 1) {
          console.log(chalk.green('\n🎉 Bridge transfer completed successfully!'));
        } else {
          console.log(chalk.red('\n❌ Transaction failed on-chain'));
        }
        break;
      } catch (error) {
        if (Date.now() - startTime >= timeout) {
          console.log(chalk.yellow('\n⚠️ Timeout waiting for receipt, but transaction may still succeed'));
          console.log(chalk.blue(`Please check manually later: https://sepolia.etherscan.io/tx/${txHash}`));
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Bridge failed:'));
    console.error(chalk.red(`- Error: ${error.message}`));
    
    if (error.code === 'CALL_EXCEPTION') {
      console.log(chalk.yellow('\n💡 Possible solutions:'));
      console.log(chalk.blue(`1. Check bridge contract: https://sepolia.etherscan.io/address/${UNION_CONTRACT.SEPOLIA}`));
      console.log(chalk.blue('2. Verify WETH is approved for bridging'));
      console.log(chalk.blue('3. Try again with higher gas limit'));
    } else if (error.message.includes('insufficient funds')) {
      console.log(chalk.yellow('\n💡 Get Sepolia ETH from a faucet:'));
      console.log(chalk.blue('https://sepoliafaucet.com'));
    } else if (error.message.includes('timed out')) {
      console.log(chalk.yellow('\n💡 Network congestion detected:'));
      console.log(chalk.blue('1. Try again later'));
      console.log(chalk.blue('2. Check your transaction on Etherscan'));
      console.log(chalk.blue('3. Consider using a different RPC endpoint'));
    }
    
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🚧 Bridge operation cancelled by user'));
  process.exit(0);
});

// Verify chalk is installed
try {
  transferWETH();
} catch (e) {
  if (e.message.includes("chalk")) {
    console.error('Missing required package. Run:');
    console.error('npm install chalk');
    process.exit(1);
  }
  throw e;
}
