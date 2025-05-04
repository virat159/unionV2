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

    // Updated transaction parameters with optimal gas settings
    const txParams = {
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: amount,
      privateKey: privateKey.trim(),
      gasSettings: {
        maxFeePerGas: ethers.parseUnits("25", "gwei"),  // Increased to 25 Gwei
        maxPriorityFeePerGas: ethers.parseUnits("20", "gwei"), // Increased to 20 Gwei
        gasLimit: 800000  // Increased to 800,000
      }
    };

    console.log(chalk.yellow('\n⏳ Initiating bridge transfer...'));
    console.log(chalk.gray(`- Amount: ${amount} WETH`));
    
    // Enhanced gas parameters logging
    console.log(chalk.gray('- Gas Parameters:'));
    console.log(chalk.gray(`  Max Fee: ${ethers.formatUnits(txParams.gasSettings.maxFeePerGas, "gwei")} Gwei`));
    console.log(chalk.gray(`  Priority Fee: ${ethers.formatUnits(txParams.gasSettings.maxPriorityFeePerGas, "gwei")} Gwei`));
    console.log(chalk.gray(`  Gas Limit: ${txParams.gasSettings.gasLimit.toString()}`));

    // Initialize provider for pre-checks
    const provider = new ethers.JsonRpcProvider(CHAINS.SEPOLIA.rpcUrl);
    const wallet = new ethers.Wallet(privateKey.trim(), provider);

    // Pre-flight checks
    console.log(chalk.yellow('\n🔍 Running pre-flight checks...'));
    
    // 1. Check ETH balance for gas
    const ethBalance = await provider.getBalance(wallet.address);
    const minEthRequired = ethers.parseUnits("0.01", "ether");
    if (ethBalance < minEthRequired) {
      throw new Error(`Insufficient ETH for gas. Need 0.01 ETH, has ${ethers.formatUnits(ethBalance, "ether")}`);
    }

    // 2. Check bridge contract status
    const bridge = new ethers.Contract(
      UNION_CONTRACT.SEPOLIA,
      ['function isActive() view returns (bool)'],
      provider
    );
    const isActive = await bridge.isActive();
    if (!isActive) throw new Error('Bridge contract is currently inactive');

    // 3. Check WETH balance
    const wethContract = new ethers.Contract(
      TOKENS.WETH.SEPOLIA,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    const wethBalance = await wethContract.balanceOf(wallet.address);
    if (wethBalance < ethers.parseUnits(amount.toString(), 18)) {
      throw new Error(`Insufficient WETH balance. Need ${amount} WETH`);
    }

    // Execute transfer with retry logic
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

    // Enhanced receipt polling
    let receipt;
    const startTime = Date.now();
    const timeout = 180000; // 3 minutes timeout
    
    while (!receipt && Date.now() - startTime < timeout) {
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        if (receipt.status === 1) {
          console.log(chalk.green('\n🎉 Bridge transfer completed successfully!'));
          console.log(chalk.gray(`- Gas used: ${receipt.gasUsed.toString()}`));
        } else {
          console.log(chalk.red('\n❌ Transaction failed on-chain'));
          console.log(chalk.blue(`Check details: https://sepolia.etherscan.io/tx/${txHash}`));
        }
        break;
      } catch (error) {
        if (Date.now() - startTime >= timeout) {
          console.log(chalk.yellow('\n⚠️ Timeout waiting for receipt'));
          console.log(chalk.blue(`Transaction may still succeed. Check later: https://sepolia.etherscan.io/tx/${txHash}`));
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Bridge failed:'));
    console.error(chalk.red(`- Error: ${error.message}`));
    
    if (error.receipt) {
      console.log(chalk.yellow('\n💡 Transaction details:'));
      console.log(chalk.blue(`- Gas used: ${error.receipt.gasUsed.toString()}`));
      console.log(chalk.blue(`- Block: ${error.receipt.blockNumber}`));
    }
    
    if (error.code === 'CALL_EXCEPTION') {
      console.log(chalk.yellow('\n💡 Possible solutions:'));
      console.log(chalk.blue(`1. Check bridge status: https://sepolia.etherscan.io/address/${UNION_CONTRACT.SEPOLIA}#readContract`));
      console.log(chalk.blue('2. Try with higher gas limit (1,000,000)'));
      console.log(chalk.blue('3. Verify WETH approval'));
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
