import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, RPC_FALLBACKS, UNION_CONTRACT, TOKENS, GAS_SETTINGS, RPC_TIMEOUTS, TRANSACTION_SETTINGS } from './config.js';

const providerCache = new Map();

// Enhanced debug logger with BigInt support
const debugLog = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  
  // Custom JSON stringifier that handles BigInt
  const replacer = (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString(); // Convert BigInt to string
    }
    return value;
  };
  
  console.log(`[${timestamp}] DEBUG: ${message}`, JSON.stringify(data, replacer, 2));
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
                  blockNumber: blockNumber.toString() // Convert BigInt to string
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
    
    debugLog("Gas parameters", {
        maxFeeGwei: "10",
        maxPriorityGwei: "9.5",
        gasLimit: gasParams.gasLimit.toString()
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
                  delay: delay.toString() 
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
                attempt: (i+1).toString(),
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
                amount: amount.toString() // Ensure amount is serializable
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
            if (balance < parsedAmount) {
                throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
            }

            // Enhanced approval flow
            const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress), 'allowance()');
            if (allowance < parsedAmount) {
                debugLog("Initiating approval", {
                    required: parsedAmount.toString(),
                    current: allowance.toString()
                });
                
                const approveTx = await withRetry(
                    () => erc20.approve(
                        safeBridgeAddress, 
                        parsedAmount * 2n, // Approve 2x amount
                        {
                            ...gasParams,
                            gasLimit: 100000 // Higher gas for approvals
                        }
                    ),
                    'approve()',
                    10000
                );
                
                await approveTx.wait(TRANSACTION_SETTINGS.blockConfirmation);
            }

            // Execute bridge transfer
            const bridge = new ethers.Contract(
                safeBridgeAddress,
                ['function depositERC20(address token, uint256 amount, uint16 destChainId)'],
                wallet
            );

            const tx = await withRetry(
                () => bridge.depositERC20(
                    tokenAddress,
                    parsedAmount,
                    CHAINS[destChain],
                    gasParams
                ),
                'depositERC20'
            );

            await tx.wait(TRANSACTION_SETTINGS.blockConfirmation);
            return tx.hash;

        } catch (error) {
            debugLog("Transaction failed", {
                error: {
                    message: error.message,
                    code: error.code,
                    data: error.data
                }
            });
            throw error;
        }
    }, 'sendToken');
};
