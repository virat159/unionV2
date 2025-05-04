import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, RPC_FALLBACKS, UNION_CONTRACT, TOKENS, GAS_SETTINGS, RPC_TIMEOUTS, TRANSACTION_SETTINGS } from './config.js';

const providerCache = new Map();

// Enhanced debug logger with BigInt support
const debugLog = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  
  // Custom serializer that safely handles BigInt and circular references
  const safeSerializer = (data) => {
    const seen = new WeakSet();
    return JSON.stringify(data, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n'; // Append 'n' to indicate BigInt
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    }, 2);
  };

  try {
    console.log(`[${timestamp}] DEBUG: ${message}`, safeSerializer(data));
  } catch (error) {
    console.log(`[${timestamp}] DEBUG: ${message}`, '[Logging error: ' + error.message + ']');
  }
};

export const getProvider = async (chainId) => {
    if (!providerCache.has(chainId)) {
        const endpoints = [
            'https://ethereum-sepolia.publicnode.com',
            RPC_URLS[chainId],
            ...(RPC_FALLBACKS[chainId] || [])
        ].filter(Boolean);

        for (const url of endpoints) {
            try {
                const provider = new ethers.JsonRpcProvider(
                    url,
                    {
                        chainId: Number(CHAINS[chainId]),
                        name: chainId.toLowerCase()
                    }
                );

                const blockNumber = await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`RPC timeout after ${RPC_TIMEOUTS.request}ms`)), RPC_TIMEOUTS.request)
                    )
                ]);
                
                debugLog(`Connected to RPC`, { 
                  url, 
                  blockNumber: blockNumber.toString() 
                });
                providerCache.set(chainId, provider);
                return provider;
            } catch (error) {
                debugLog(`RPC endpoint failed`, { 
                  url, 
                  error: error.message 
                });
                continue;
            }
        }
        throw new Error(`All RPC endpoints failed for ${chainId}`);
    }
    return providerCache.get(chainId);
};

const getSafeAddress = (address) => {
    if (!address) return address;
    try {
        return ethers.getAddress(address);
    } catch {
        try {
            return ethers.getAddress(address.toLowerCase());
        } catch {
            return address;
        }
    }
};

const getGasParams = async () => {
    // Strict 10/9.5 Gwei enforcement
    const gasParams = {
        maxFeePerGas: ethers.parseUnits("10", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("9.5", "gwei"),
        gasLimit: 500000
    };
    
    debugLog("Gas parameters enforced", {
        maxFeeGwei: ethers.formatUnits(gasParams.maxFeePerGas, "gwei"),
        maxPriorityGwei: ethers.formatUnits(gasParams.maxPriorityFeePerGas, "gwei"),
        gasLimit: gasParams.gasLimit
    });
    
    return gasParams;
};

const withRetry = async (fn, operation = 'operation', customDelay = null) => {
    let lastError;
    for (let i = 0; i < TRANSACTION_SETTINGS.maxRetries; i++) {
        try {
            const delay = i > 0 ? (customDelay || GAS_SETTINGS.retryDelay) : 0;
            if (delay > 0) {
                debugLog(`Retry delay`, { 
                  operation, 
                  delay 
                });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            debugLog(`Attempt ${i+1}/${TRANSACTION_SETTINGS.maxRetries}`, { 
              operation 
            });
            return await fn();
        } catch (error) {
            lastError = error;
            debugLog(`Attempt failed`, { 
                operation,
                attempt: i+1,
                error: {
                    message: error.message,
                    code: error.code,
                    data: error.data
                }
            });
            
            if (i < TRANSACTION_SETTINGS.maxRetries - 1) continue;
            throw lastError;
        }
    }
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
    return withRetry(async () => {
        try {
            debugLog("Starting bridge transfer", {
                sourceChain,
                destChain,
                asset,
                amount: amount.toString()
            });

            // Validate chains
            if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
                throw new Error(`Invalid chain: ${sourceChain} → ${destChain}`);
            }
            if (!privateKey?.trim()) {
                throw new Error('Invalid private key');
            }

            const provider = await getProvider(sourceChain);
            const wallet = new ethers.Wallet(privateKey, provider);
            
            // Get enforced gas parameters
            const gasParams = await getGasParams();

            // Verify bridge contract
            const bridgeAddress = UNION_CONTRACT[sourceChain];
            if (!bridgeAddress || bridgeAddress.startsWith('0x000')) {
                throw new Error(`Missing bridge address for ${sourceChain}`);
            }
            const safeBridgeAddress = getSafeAddress(bridgeAddress);

            // Handle native ETH transfers
            const isNative = asset === 'native' || asset === 'NATIVE';
            if (isNative) {
                const bridge = new ethers.Contract(
                    safeBridgeAddress,
                    ['function depositNative(uint16 destChainId) payable'],
                    wallet
                );
                
                const tx = await bridge.depositNative(
                    CHAINS[destChain],
                    {
                        value: ethers.parseEther(amount.toString()),
                        ...gasParams
                    }
                );
                return tx.hash;
            }

            // Handle ERC20 token transfers
            const tokenAddress = asset === 'WETH' && sourceChain === 'SEPOLIA' 
                ? TOKENS.WETH.SEPOLIA
                : getSafeAddress(asset);

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

            // Get token decimals with fallback
            const decimals = await withRetry(() => erc20.decimals().catch(() => 18), 'decimals()');
            const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

            // Check balance
            const balance = await withRetry(() => erc20.balanceOf(wallet.address), 'balanceOf()');
            debugLog("Balance verification", {
                balance: ethers.formatUnits(balance, decimals),
                required: ethers.formatUnits(parsedAmount, decimals),
                sufficient: balance >= parsedAmount
            });

            if (balance < parsedAmount) {
                throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
            }

            // Enhanced approval flow
            const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress), 'allowance()');
            debugLog("Allowance verification", {
                current: ethers.formatUnits(allowance, decimals),
                required: ethers.formatUnits(parsedAmount, decimals),
                needsApproval: allowance < parsedAmount
            });

            if (allowance < parsedAmount) {
                debugLog("Initiating token approval", {
                    spender: safeBridgeAddress,
                    amount: ethers.formatUnits(parsedAmount * 2n, decimals)
                });
                
                const approveTx = await withRetry(
                    () => erc20.approve(
                        safeBridgeAddress, 
                        parsedAmount * 2n,
                        {
                            ...gasParams,
                            gasLimit: 100000
                        }
                    ),
                    'approve()',
                    10000
                );
                
                debugLog("Approval transaction sent", {
                    hash: approveTx.hash,
                    gasUsed: approveTx.gasLimit.toString()
                });
                await approveTx.wait(TRANSACTION_SETTINGS.blockConfirmation);
            }

            // Execute bridge transfer
            const bridge = new ethers.Contract(
                safeBridgeAddress,
                ['function depositERC20(address token, uint256 amount, uint16 destChainId)'],
                wallet
            );

            debugLog("Executing bridge transfer", {
                token: tokenAddress,
                amount: ethers.formatUnits(parsedAmount, decimals),
                destinationChainId: CHAINS[destChain]
            });

            const tx = await withRetry(
                () => bridge.depositERC20(
                    tokenAddress,
                    parsedAmount,
                    CHAINS[destChain],
                    gasParams
                ),
                'depositERC20'
            );

            debugLog("Bridge transaction submitted", {
                hash: tx.hash,
                gasLimit: tx.gasLimit.toString(),
                maxFeePerGas: ethers.formatUnits(tx.maxFeePerGas, 'gwei'),
                maxPriorityFeePerGas: ethers.formatUnits(tx.maxPriorityFeePerGas, 'gwei')
            });

            await tx.wait(TRANSACTION_SETTINGS.blockConfirmation);
            return tx.hash;

        } catch (error) {
            debugLog("Transaction failed", {
                error: {
                    message: error.message,
                    code: error.code,
                    data: error.data,
                    stack: error.stack
                }
            });
            
            if (error.code === 'CALL_EXCEPTION') {
                debugLog("Troubleshooting tips", [
                    '1. Verify token approval completed successfully',
                    '2. Check bridge contract status on Etherscan',
                    '3. Confirm token contract is valid'
                ]);
            }
            
            throw error;
        }
    }, 'sendToken');
};
