import { ethers } from 'ethers';
import { sendToken } from '../utils.js';
import { CHAINS, TOKENS, UNION_CONTRACT } from '../config.js';
import pkg from 'prompt-sync';
import chalk from 'chalk';
const prompt = pkg({ sigint: true });

// Ultra-reliable provider with multiple fallbacks
const getProvider = async () => {
  const RPC_ENDPOINTS = [
    'https://eth-sepolia.g.alchemy.com/v2/demo', // Alchemy
    'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161', // Infura
    'https://rpc.sepolia.org', // Community endpoint
    'https://ethereum-sepolia.publicnode.com' // Public node
  ];

  for (const url of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.JsonRpcProvider(url, {
        chainId: 11155111,
        name: 'sepolia',
        staticNetwork: true
      });
      
      // Verify connection works
      await provider.getBlockNumber();
      console.log(chalk.green(`✓ Connected to ${url.split('/')[2]}`));
      return provider;
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Failed ${url.split('/')[2]}: ${error.message}`));
    }
  }
  throw new Error('All RPC endpoints failed');
};

const transferWETH = async () => {
  try {
    console.log(chalk.blue('\n🔗 Sepolia to Holesky WETH Bridge\n'));
    
    const privateKey = prompt('Enter your Sepolia private key (hidden): ', { echo: '*' })?.trim();
    if (!privateKey) throw new Error('No private key provided');

    const provider = await getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const amount = 0.0001;
    
    console.log(chalk.yellow('\n🔍 Running pre-flight checks...'));
    
    // 1. ETH Balance Check (for gas)
    const ethBalance = await provider.getBalance(wallet.address);
    const minEth = ethers.parseUnits("0.05", "ether"); // Increased minimum
    if (ethBalance < minEth) {
      throw new Error(`Insufficient ETH for gas (need 0.05, has ${ethers.formatUnits(ethBalance, 18)})`);
    }

    // 2. WETH Balance Check
    const weth = new ethers.Contract(
      TOKENS.WETH.SEPOLIA,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    const wethBalance = await weth.balanceOf(wallet.address);
    const requiredWeth = ethers.parseUnits(amount.toString(), 18);
    if (wethBalance < requiredWeth) {
      throw new Error(`Need ${amount} WETH, only have ${ethers.formatUnits(wethBalance, 18)}`);
    }

    // 3. Bridge Contract Check
    const bridge = new ethers.Contract(
      UNION_CONTRACT.SEPOLIA,
      ['function isActive() view returns (bool)'],
      provider
    );
    const isActive = await bridge.isActive().catch(() => false);
    if (!isActive) throw new Error('Bridge contract is not active');

    // Updated Gas Parameters (Higher values)
    const gasParams = {
      maxFeePerGas: ethers.parseUnits("30", "gwei"), // Increased from 25
      maxPriorityFeePerGas: ethers.parseUnits("25", "gwei"), // Increased from 20
      gasLimit: 1000000 // Increased to 1,000,000 gas
    };

    console.log(chalk.yellow('\n🚀 Transaction Details:'));
    console.log(chalk.gray(`- Amount: ${amount} WETH`));
    console.log(chalk.gray(`- Max Fee: 30 Gwei`));
    console.log(chalk.gray(`- Priority Fee: 25 Gwei`));
    console.log(chalk.gray(`- Gas Limit: 1,000,000`));

    const txHash = await sendToken({
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: amount,
      privateKey: privateKey,
      gasSettings: gasParams
    });

    console.log(chalk.green(`\n✅ Transaction submitted!\nTrack at: https://sepolia.etherscan.io/tx/${txHash}`));
    
    // Enhanced receipt waiting
    console.log(chalk.yellow('\n⏳ Waiting for confirmation... (up to 3 minutes)'));
    const receipt = await provider.waitForTransaction(txHash, 3, 180000);
    
    if (receipt.status === 1) {
      console.log(chalk.green('\n🎉 Success! Bridge transfer completed.'));
      console.log(chalk.gray(`Gas used: ${receipt.gasUsed.toString()}`));
    } else {
      console.log(chalk.red('\n❌ Transaction failed on-chain'));
      console.log(chalk.blue(`Check details: https://sepolia.etherscan.io/tx/${txHash}`));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), chalk.red(error.message));
    
    if (error.message.includes('gas')) {
      console.log(chalk.yellow('\n💡 Try:'));
      console.log(chalk.blue('1. Wait for lower network congestion'));
      console.log(chalk.blue('2. Try with gas limit 1,200,000'));
    }
    process.exit(1);
  }
};

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
