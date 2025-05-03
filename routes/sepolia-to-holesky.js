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

    // Enhanced transaction parameters
    const txParams = {
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: amount,
      privateKey: privateKey.trim(),
      gasSettings: {
        maxFeePerGas: ethers.parseUnits("3", "gwei"),  // Increased from 2.5
        maxPriorityFeePerGas: ethers.parseUnits("2.5", "gwei"), // Increased from 2
        gasLimit: 350000  // Increased from 250000
      }
    };

    console.log(chalk.yellow('\n⏳ Initiating bridge transfer...'));
    console.log(chalk.gray(`- Amount: ${amount} WETH`));
    console.log(chalk.gray(`- Max Fee: 3 Gwei`));
    console.log(chalk.gray(`- Priority Fee: 2.5 Gwei`));
    console.log(chalk.gray(`- Gas Limit: 350000`));

    const txHash = await sendToken(txParams);

    console.log(chalk.green(`
    ✅ Successfully bridged ${amount} WETH!
    Transaction Hash: ${chalk.underline(`https://sepolia.etherscan.io/tx/${txHash}`)}
    `));
    
    console.log(chalk.yellow('\n⏳ Waiting for completion on Holesky...'));
    console.log(chalk.gray('This may take 2-5 minutes...'));

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
