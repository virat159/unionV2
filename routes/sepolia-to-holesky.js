import { ethers } from 'ethers';
import { sendToken } from '../utils.js';
import { CHAINS, TOKENS, UNION_CONTRACT } from '../config.js';
import pkg from 'prompt-sync';
import chalk from 'chalk';
const prompt = pkg({ sigint: true });

// Add this NEW provider function at the top of the file
const getProviderWithRetry = async () => {
  const RPC_URLS = [
    'https://rpc.sepolia.org',                  // Primary
    'https://ethereum-sepolia.publicnode.com',  // Fallback 1 
    'https://sepolia.drpc.org'                  // Fallback 2
  ];

  for (const url of RPC_URLS) {
    try {
      const provider = new ethers.JsonRpcProvider(url, {
        chainId: 11155111, // Sepolia chain ID
        name: 'sepolia'
      });
      await provider.getBlockNumber(); // Test connection
      console.log(chalk.green(`✓ Connected to ${url}`));
      return provider;
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Failed to connect to ${url}`));
    }
  }
  throw new Error('All RPC endpoints failed');
};

// Update the transferWETH function like this:
const transferWETH = async () => {
  try {
    console.log(chalk.blue('\n🔗 Sepolia to Holesky WETH Bridge\n'));
    
    const privateKey = prompt('Enter your Sepolia private key (hidden): ', { echo: '*' })?.trim();
    if (!privateKey) throw new Error('No private key provided');

    const provider = await getProviderWithRetry(); // Use the new provider function
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const amount = 0.0001;
    console.log(chalk.yellow('\n⏳ Running pre-flight checks...'));
    
    // ETH Balance Check
    const ethBalance = await provider.getBalance(wallet.address);
    if (ethBalance < ethers.parseUnits("0.01", "ether")) {
      throw new Error(`Insufficient ETH (need 0.01, has ${ethers.formatUnits(ethBalance, 18)}`);
    }

    // WETH Balance Check
    const weth = new ethers.Contract(TOKENS.WETH.SEPOLIA, 
      ['function balanceOf(address) view returns (uint256)'], 
      provider);
    const wethBalance = await weth.balanceOf(wallet.address);
    if (wethBalance < ethers.parseUnits(amount.toString(), 18)) {
      throw new Error(`Insufficient WETH (need ${amount}, has ${ethers.formatUnits(wethBalance, 18)})`);
    }

    // Updated Transaction Parameters
    const txParams = {
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: amount,
      privateKey: privateKey,
      gasSettings: {
        maxFeePerGas: ethers.parseUnits("25", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("20", "gwei"),
        gasLimit: 800000
      }
    };

    console.log(chalk.yellow('\n🚀 Transaction Details:'));
    console.log(chalk.gray(`- Amount: ${amount} WETH`));
    console.log(chalk.gray(`- Max Fee: 25 Gwei`));
    console.log(chalk.gray(`- Priority Fee: 20 Gwei`));
    console.log(chalk.gray(`- Gas Limit: 800,000`));

    const txHash = await sendToken(txParams);
    console.log(chalk.green(`\n✅ Success! Transaction Hash:\n${chalk.underline(`https://sepolia.etherscan.io/tx/${txHash}`)}`));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), chalk.red(error.message));
    if (error.message.includes('RPC')) {
      console.log(chalk.yellow('\n💡 Try:'));
      console.log(chalk.blue('1. Check your internet connection'));
      console.log(chalk.blue('2. Wait 1 minute and try again'));
    }
    process.exit(1);
  }
};

// Keep the rest of the file unchanged
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🚧 Operation cancelled'));
  process.exit(0);
});

try {
  transferWETH();
} catch (e) {
  if (e.message.includes("chalk")) {
    console.error('Run: npm install chalk');
    process.exit(1);
  }
  throw e;
}
