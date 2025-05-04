import { ethers } from 'ethers';
import { 
  CHAINS, 
  RPC_URLS, 
  RPC_FALLBACKS, 
  UNION_CONTRACT, 
  TOKENS, 
  GAS_SETTINGS, 
  RPC_TIMEOUTS, 
  TRANSACTION_SETTINGS 
} from './config.js';

const providerCache = new Map();

const debugLog = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  const safeData = {
    ...data,
    ...(data.value ? { value: data.value.toString() } : {}),
    ...(data.amount ? { amount: data.amount.toString() } : {})
  };
  console.log(`[${timestamp}] DEBUG: ${message}`, JSON.stringify(safeData, null, 2));
};

const getGasParams = async (provider, overrideSettings = {}) => {
  try {
    const feeData = await provider.getFeeData();
    const calculatedParams = {
      maxFeePerGas: overrideSettings.maxFeePerGas || 
                   (feeData.maxFeePerGas * 125n / 100n) || 
                   ethers.parseUnits("20", "gwei"),
      maxPriorityFeePerGas: overrideSettings.maxPriorityFeePerGas || 
                          (feeData.maxPriorityFeePerGas * 125n / 100n) || 
                          ethers.parseUnits("15", "gwei"),
      gasLimit: overrideSettings.gasLimit || 500000
    };

    debugLog("Calculated gas parameters", {
      maxFeeGwei: ethers.formatUnits(calculatedParams.maxFeePerGas, "gwei"),
      maxPriorityGwei: ethers.formatUnits(calculatedParams.maxPriorityFeePerGas, "gwei"),
      gasLimit: calculatedParams.gasLimit
    });

    return calculatedParams;
  } catch (error) {
    debugLog("Failed to get dynamic gas params, using defaults", { error: error.message });
    return {
      maxFeePerGas: ethers.parseUnits("20", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("15", "gwei"),
      gasLimit: 500000
    };
  }
};

export const getProvider = async (chainId) => {
  if (!providerCache.has(chainId)) {
    const endpoints = [
      RPC_URLS[chainId],
      ...(RPC_FALLBACKS[chainId] || []),
      'https://ethereum-sepolia.publicnode.com'
    ].filter(Boolean);

    for (const url of endpoints) {
      try {
        const provider = new ethers.JsonRpcProvider(url, {
          chainId: Number(CHAINS[chainId]),
          name: chainId.toLowerCase()
        });

        // Fixed Promise.race syntax
        await Promise.race([
          provider.getBlockNumber(),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error(`RPC timeout after ${RPC_TIMEOUTS.request}ms`));
            }, RPC_TIMEOUTS.request);
          })
        ]);

        debugLog(`Connected to RPC`, { url, chainId });
        providerCache.set(chainId, provider);
        return provider;
      } catch (error) {
        debugLog(`RPC endpoint failed`, { url, error: error.message });
        continue;
      }
    }
    throw new Error(`All RPC endpoints failed for ${chainId}`);
  }
  return providerCache.get(chainId);
};

const executeTransaction = async (contract, method, args, overrides, operationName) => {
  const txResponse = await contract[method](...args, overrides);
  debugLog("Transaction submitted", {
    operation: operationName,
    hash: txResponse.hash,
    gasLimit: txResponse.gasLimit.toString(),
    maxFeePerGas: ethers.formatUnits(txResponse.maxFeePerGas, 'gwei'),
    maxPriorityFeePerGas: ethers.formatUnits(txResponse.maxPriorityFeePerGas, 'gwei')
  });

  const receipt = await txResponse.wait();
  debugLog("Transaction mined", {
    status: receipt.status === 1 ? "success" : "failed",
    confirmations: receipt.confirmations,
    gasUsed: receipt.gasUsed.toString()
  });

  if (receipt.status !== 1) throw new Error("Transaction failed on-chain");
  return receipt;
};

export const sendToken = async ({ 
  sourceChain, 
  destChain, 
  asset, 
  amount, 
  privateKey, 
  gasSettings = {},
  recipient = null
}) => {
  try {
    debugLog("Starting bridge transfer", {
      sourceChain,
      destChain,
      asset,
      amount: amount.toString(),
      recipient
    });

    // Validate configuration
    if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
      throw new Error(`Invalid chain configuration: ${sourceChain} → ${destChain}`);
    }
    if (!privateKey?.match(/^0x[0-9a-fA-F]{64}$/)) {
      throw new Error('Invalid private key format (must be 64 hex chars with 0x prefix)');
    }

    const provider = await getProvider(sourceChain);
    const wallet = new ethers.Wallet(privateKey, provider);
    const gasParams = await getGasParams(provider, gasSettings);
    const bridgeAddress = UNION_CONTRACT[sourceChain];
    
    if (!bridgeAddress) throw new Error(`Missing bridge address for ${sourceChain}`);
    
    // Handle native token transfer
    const isNative = asset === 'native' || asset === 'NATIVE';
    const tokenAddress = isNative ? null : 
      (asset === 'WETH' ? TOKENS.WETH[sourceChain] : asset);

    if (isNative) {
      const bridge = new ethers.Contract(
        bridgeAddress,
        ['function depositNative(uint16 destChainId, address recipient) payable'],
        wallet
      );
      
      // Fixed executeTransaction parameters
      const tx = await executeTransaction(
        bridge,
        'depositNative',
        [CHAINS[destChain], recipient || wallet.address],
        {
          value: ethers.parseEther(amount.toString()),
          ...gasParams
        },
        'nativeDeposit'
      );
      return tx.hash;
    }

    // Handle ERC20 token transfer
    const erc20 = new ethers.Contract(
      tokenAddress,
      [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function balanceOf(address owner) view returns (uint256)',
        'function allowance(address owner, address spender) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ],
      wallet
    );

    const decimals = await erc20.decimals().catch(() => 18);
    const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

    // Check balance
    const balance = await erc20.balanceOf(wallet.address);
    debugLog("Balance check", {
      balance: ethers.formatUnits(balance, decimals),
      required: amount,
      sufficient: balance >= parsedAmount
    });
    if (balance < parsedAmount) {
      throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
    }

    // Check and set approval if needed
    const allowance = await erc20.allowance(wallet.address, bridgeAddress);
    if (allowance < parsedAmount) {
      debugLog("Approving token transfer", {
        required: ethers.formatUnits(parsedAmount, decimals),
        currentAllowance: ethers.formatUnits(allowance, decimals)
      });

      await executeTransaction(
        erc20,
        'approve',
        [bridgeAddress, parsedAmount * 2n],
        {
          ...gasParams,
          gasLimit: 100000
        },
        'tokenApproval'
      );
    }

    // Execute bridge transfer
    const bridge = new ethers.Contract(
      bridgeAddress,
      ['function depositERC20(address token, uint256 amount, uint16 destChainId, address recipient)'],
      wallet
    );

    const tx = await executeTransaction(
      bridge,
      'depositERC20',
      [
        tokenAddress, 
        parsedAmount, 
        CHAINS[destChain],
        recipient || wallet.address
      ],
      gasParams,
      'tokenBridgeTransfer'
    );

    return tx.hash;

  } catch (error) {
    debugLog("Bridge transfer failed", {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      troubleshooting: [
        '1. Verify RPC endpoint is responsive',
        '2. Check token balance and approvals',
        '3. Confirm bridge contract is operational',
        '4. Validate chain configurations'
      ]
    });
    throw error;
  }
};
