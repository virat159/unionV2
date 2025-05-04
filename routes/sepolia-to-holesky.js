import { ethers } from 'ethers';
import { sendToken } from '../utils.js';
import { CHAINS, TOKENS, UNION_CONTRACT } from '../config.js';
import pkg from 'prompt-sync';
import chalk from 'chalk';
const prompt = pkg({ sigint: true });

// ====================== RPC Configuration ======================
const RPC_ENDPOINTS = [
  'https://eth-sepolia.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB', // Primary (your Alchemy)
  'https://eth-holesky.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB', // Fallback
  'https://rpc2.sepolia.org', // Secondary community endpoint
];

// ====================== Enhanced Provider ======================
const getProvider = async () => {
  let lastError;
  
  for (const url of RPC_ENDPOINTS) {
    try {
      const chainId = url.includes('holesky') ? 17000 : 11155111;
      const provider = new ethers.JsonRpcProvider(url, {
        chainId,
        name: url.includes('holesky') ? 'holesky' : 'sepolia',
        staticNetwork: true,
        batchMaxCount: 1, // Avoids RPC timeouts
      });

      // Aggressive connection testing
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RPC timeout')), 5000)
        )
      ]);

      console.log(chalk.green(`✓ Connected to ${new URL(url).hostname}`));
      return provider;
    } catch (error) {
      lastError = error;
      console.log(chalk.yellow(`⚠️ ${new URL(url).hostname}: ${error.shortMessage || error.message}`));
    }
  }
  throw new Error(`All RPCs failed. Last error: ${lastError?.message}`);
};

// ====================== Core Bridge Function ======================
const transferWETH = async () => {
  try {
    console.log(chalk.blue('\n🔗 Sepolia to Holesky WETH Bridge\n'));
    
    // Secure private key input
    const privateKey = prompt('Enter your Sepolia private key (hidden): ', { 
      echo: '*',
      autocomplete: []
    })?.trim();
    if (!privateKey || !privateKey.match(/^0x[0-9a-fA-F]{64}$/)) {
      throw new Error('Invalid private key format (must be 64 hex chars with 0x prefix)');
    }

    const provider = await getProvider();
    const wallet = new ethers.Wallet(privateKey, provider);
    
    console.log(chalk.gray(`\nWallet: ${wallet.address}`));
    
    // Dynamic amount input
    const amountInput = prompt('Enter WETH amount to bridge (default: 0.0001): ') || '0.0001';
    const amount = parseFloat(amountInput);
    if (isNaN(amount) throw new Error('Invalid amount');

    // ========== Pre-Flight Checks ==========
    console.log(chalk.yellow('\n🔍 Running pre-flight checks...'));
    
    // 1. ETH Balance Check (gas)
    const ethBalance = await provider.getBalance(wallet.address);
    const minEth = ethers.parseUnits("0.05", "ether");
    console.log(chalk.gray(`- ETH Balance: ${ethers.formatUnits(ethBalance, 18)}`));
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
    console.log(chalk.gray(`- WETH Balance: ${ethers.formatUnits(wethBalance, 18)}`));
    if (wethBalance < requiredWeth) {
      throw new Error(`Need ${amount} WETH, only have ${ethers.formatUnits(wethBalance, 18)}`);
    }

    // 3. Bridge Contract Status
    const bridge = new ethers.Contract(
      UNION_CONTRACT.SEPOLIA,
      [
        'function isActive() view returns (bool)',
        'function minDeposit() view returns (uint256)'
      ],
      provider
    );
    
    const [isActive, minDeposit] = await Promise.all([
      bridge.isActive().catch(() => false),
      bridge.minDeposit().catch(() => ethers.parseUnits("0.0001", 18))
    ]);
    
    if (!isActive) throw new Error('Bridge contract is not active');
    if (requiredWeth < minDeposit) {
      throw new Error(`Amount below minimum deposit (${ethers.formatUnits(minDeposit, 18)} WETH)`);
    }

    // ========== Gas Optimization ==========
    const feeData = await provider.getFeeData();
    const gasParams = {
      maxFeePerGas: feeData.maxFeePerGas * 2n || ethers.parseUnits("30", "gwei"),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas * 2n || ethers.parseUnits("2", "gwei"),
      gasLimit: 1_200_000, // Safe upper limit
    };

    console.log(chalk.yellow('\n🚀 Transaction Details:'));
    console.log(chalk.gray(`- Amount:    ${amount} WETH`));
    console.log(chalk.gray(`- Max Fee:   ${ethers.formatUnits(gasParams.maxFeePerGas, 'gwei')} Gwei`));
    console.log(chalk.gray(`- Priority:  ${ethers.formatUnits(gasParams.maxPriorityFeePerGas, 'gwei')} Gwei`));
    console.log(chalk.gray(`- Gas Limit: ${gasParams.gasLimit.toLocaleString()}`));

    // ========== Execute Bridge ==========
    const txHash = await sendToken({
      sourceChain: 'SEPOLIA',
      destChain: 'HOLESKY',
      asset: TOKENS.WETH.SEPOLIA,
      amount: amount,
      privateKey: privateKey,
      gasSettings: gasParams
    });

    console.log(chalk.green(`\n✅ Transaction submitted!\nTrack at: https://sepolia.etherscan.io/tx/${txHash}`));
    
    // ========== Receipt Monitoring ==========
    console.log(chalk.yellow('\n⏳ Waiting for confirmation... (up to 5 minutes)'));
    const receipt = await provider.waitForTransaction(txHash, 2, 300000); // 5 min timeout
    
    if (receipt.status === 1) {
      console.log(chalk.green('\n🎉 Success! Bridge transfer completed.'));
      console.log(chalk.gray(`- Gas used: ${receipt.gasUsed.toString()}`));
      console.log(chalk.gray(`- Block:    ${receipt.blockNumber}`));
    } else {
      console.log(chalk.red('\n❌ Transaction failed on-chain'));
      console.log(chalk.blue(`Details: https://sepolia.etherscan.io/tx/${txHash}`));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Critical Error:'), chalk.red(error.message));
    
    // Helpful debug tips
    if (error.message.includes('reverted')) {
      console.log(chalk.yellow('\n💡 Contract reverted. Possible:'));
      console.log(chalk.blue('- Bridge paused'));
      console.log(chalk.blue('- Insufficient approval'));
    } else if (error.message.includes('gas')) {
      console.log(chalk.yellow('\n💡 Gas suggestion:'));
      console.log(chalk.blue('- Try maxFeePerGas: 35 Gwei'));
    }
    
    process.exit(1);
  }
};

// ====================== Execution ======================
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🚧 Operation cancelled by user'));
  process.exit(0);
});

// Dependency check
try {
  transferWETH();
} catch (e) {
  if (e.message.includes("chalk")) {
    console.error('Missing dependencies. Run:\nnpm install chalk prompt-sync');
    process.exit(1);
  }
  throw e;
}
