import { sendToken } from '../utils.js';
import { CHAINS, TOKENS, BRIDGE_SETTINGS } from '../config.js';
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

    const amount = 0.0001; // Fixed amount or could make this configurable
    
    console.log(chalk.yellow('\n⏳ Initiating bridge transfer...'));
    console.log(chalk.gray(`- Amount: ${amount} WETH`));
    console.log(chalk.gray(`- From: Sepolia (Chain ID ${CHAINS.SEPOLIA})`));
    console.log(chalk.gray(`- To: Holesky (Chain ID ${CHAINS.HOLESKY})`));

    const txHash = await sendToken({
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: amount,
      privateKey: privateKey.trim()
    });

    console.log(chalk.green(`
    ✅ Successfully bridged ${amount} WETH!
    Transaction Hash: ${chalk.underline(`https://sepolia.etherscan.io/tx/${txHash}`)
    }`));
    
    console.log(chalk.yellow('\n⏳ Waiting for completion on Holesky...'));
    console.log(chalk.gray('This may take a few minutes...'));

  } catch (error) {
    console.error(chalk.red('\n❌ Bridge failed:'));
    console.error(chalk.red(`- Error: ${error.message}`));
    if (error.code) console.error(chalk.red(`- Code: ${error.code}`));
    
    // Suggest common solutions
    if (error.message.includes('insufficient funds')) {
      console.log(chalk.yellow('\n💡 Try getting Sepolia ETH from a faucet:'));
      console.log(chalk.blue('https://sepoliafaucet.com'));
    }
    
    process.exit(1);
  }
};

// Add graceful shutdown handling
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🚧 Bridge operation cancelled by user'));
  process.exit(0);
});

transferWETH();
