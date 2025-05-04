import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, RPC_FALLBACKS, UNION_CONTRACT, TOKENS, GAS_SETTINGS, RPC_TIMEOUTS, TRANSACTION_SETTINGS } from './config.js';

const providerCache = new Map();

// Enhanced debug logger
const debugLog = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] DEBUG: ${message}`, JSON.stringify(data, null, 2));
};

export const getProvider = async (chainId) => {
    if (!providerCache.has(chainId)) {
        const endpoints = [
            'https://ethereum-sepolia.publicnode.com', // Primary reliable endpoint
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
                
                debugLog(`Connected to RPC`, { url, blockNumber });
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
    return {
        maxFeePerGas: ethers.parseUnits("10", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("9.5", "gwei"),
        gasLimit: 500000
    };
};

const withRetry = async (fn, operation = 'operation', customDelay = null) => {
    let lastError;
    for (let i = 0; i < TRANSACTION_SETTINGS.maxRetries; i++) {
        try {
            const delay = i > 0 ? (customDelay || GAS_SETTINGS.retryDelay) : 0;
            if (delay > 0) {
                debugLog(`Retry delay`, { operation, delay });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            debugLog(`Attempt ${i+1}/${TRANSACTION_SETTINGS.maxRetries}`, { operation });
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
                amount
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
            debugLog("Gas parameters enforced", gasParams);

            // Verify bridge contract
            const bridgeAddress = UNION_CONTRACT[sourceChain];
            if (!bridgeAddress || bridgeAddress.startsWith('0x000')) {
                throw new Error(`Missing bridge address for ${sourceChain}`);
            }
            const safeBridgeAddress = getSafeAddress(bridgeAddress);

            // Check contract deployment
            const bridgeCode = await provider.getCode(safeBridgeAddress);
            if (bridgeCode === '0x') {
                throw new Error(`Bridge contract not deployed at ${safeBridgeAddress}`);
            }

            // Handle native ETH transfers
            const isNative = asset === 'native' || asset === 'NATIVE';
            if (isNative) {
                debugLog("Handling native ETH transfer");
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
                
                debugLog("Native transfer initiated", { txHash: tx.hash });
                return tx.hash;
            }

            // Handle ERC20 (WETH) transfers
            const tokenAddress = asset === 'WETH' && sourceChain === 'SEPOLIA' 
                ? TOKENS.WETH.SEPOLIA
                : getSafeAddress(asset);

            debugLog("Using token contract", { tokenAddress });
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
            debugLog("Amount parsed", { input: amount, parsed: parsedAmount.toString(), decimals });

            // Check balance
            const balance = await withRetry(() => erc20.balanceOf(wallet.address), 'balanceOf()');
            debugLog("Balance check", { 
                balance: ethers.formatUnits(balance, decimals),
                required: amount 
            });

            if (balance < parsedAmount) {
                throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
            }

            // Enhanced approval flow
            const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress), 'allowance()');
            debugLog("Allowance check", {
                current: ethers.formatUnits(allowance, decimals),
                required: ethers.formatUnits(parsedAmount, decimals)
            });

            if (allowance < parsedAmount) {
                debugLog("Initiating approval");
                const approvalAmount = parsedAmount * 2n; // Approve 2x required amount
                
                const approveTx = await withRetry(
                    () => erc20.approve(
                        safeBridgeAddress, 
                        approvalAmount, 
                        {
                            ...gasParams,
                            gasLimit: 100000 // Higher gas for approvals
                        }
                    ),
                    'approve()',
                    10000
                );
                
                debugLog("Approval sent", { txHash: approveTx.hash });
                await approveTx.wait(TRANSACTION_SETTINGS.blockConfirmation);
                debugLog("Approval confirmed");
            }

            // Execute bridge transfer
            debugLog(`Initiating bridge to ${destChain}`);
            const bridge = new ethers.Contract(
                safeBridgeAddress,
                ['function depositERC20(address token, uint256 amount, uint16 destChainId)'],
                wallet
            );

            // Pre-flight simulation
            try {
                await bridge.callStatic.depositERC20(
                    tokenAddress,
                    parsedAmount,
                    CHAINS[destChain],
                    gasParams
                );
                debugLog("Simulation successful");
            } catch (simError) {
                debugLog("Simulation failed", { error: simError.message });
                throw simError;
            }

            const tx = await withRetry(
                () => bridge.depositERC20(
                    tokenAddress,
                    parsedAmount,
                    CHAINS[destChain],
                    gasParams
                ),
                'depositERC20'
            );

            debugLog("Bridge transaction sent", { txHash: tx.hash });
            await tx.wait(TRANSACTION_SETTINGS.blockConfirmation);
            debugLog("Bridge transaction confirmed");

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
            
            // Specific error handling
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
