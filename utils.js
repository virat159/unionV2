import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, RPC_FALLBACKS, UNION_CONTRACT, TOKENS, GAS_SETTINGS, RPC_TIMEOUTS, TRANSACTION_SETTINGS } from './config.js';

const providerCache = new Map();

// Debug logger
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

                // Enhanced connection test
                const blockNumber = await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`RPC timeout after ${RPC_TIMEOUTS.request}ms`)), RPC_TIMEOUTS.request)
                    )
                ]);
                
                debugLog(`Connected to ${url}`, { blockNumber });
                providerCache.set(chainId, provider);
                return provider;
            } catch (error) {
                debugLog(`RPC endpoint failed (${url})`, { error: error.message });
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
            return address; // For non-EVM addresses
        }
    }
};

const getGasParams = async (provider) => {
    // ENFORCE 10/9.5 GWEI MINIMUMS
    const gasParams = {
        maxFeePerGas: ethers.parseUnits("10", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("9.5", "gwei"),
        gasLimit: 500000
    };
    
    debugLog("Enforced gas parameters", {
        maxFeeGwei: "10",
        maxPriorityGwei: "9.5",
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
                debugLog(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            debugLog(`Attempt ${i+1}/${TRANSACTION_SETTINGS.maxRetries} for ${operation}`);
            return await fn();
        } catch (error) {
            lastError = error;
            debugLog(`Attempt ${i+1} failed`, { 
                operation,
                error: error.message,
                code: error.code,
                data: error.data 
            });
            
            if (i < TRANSACTION_SETTINGS.maxRetries - 1) {
                continue;
            }
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

            // Validate input parameters
            if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
                throw new Error(`Invalid chain: ${sourceChain} → ${destChain}`);
            }
            if (!privateKey || !privateKey.trim()) {
                throw new Error('Invalid private key');
            }

            const provider = await getProvider(sourceChain);
            const wallet = new ethers.Wallet(privateKey, provider);
            
            // Get enforced gas parameters
            const gasParams = await getGasParams(provider);

            const bridgeAddress = UNION_CONTRACT[sourceChain];
            if (!bridgeAddress || bridgeAddress.startsWith('0x000')) {
                throw new Error(`Missing bridge address for ${sourceChain}`);
            }
            const safeBridgeAddress = getSafeAddress(bridgeAddress);

            // Verify bridge contract
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
                
                debugLog("Native ETH transfer initiated", { txHash: tx.hash });
                return tx.hash;
            }

            // Handle ERC20 token transfers
            const tokenAddress = asset === 'WETH' && sourceChain === 'SEPOLIA' 
                ? '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'
                : getSafeAddress(asset);

            debugLog("Using token address", { tokenAddress });

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

            debugLog("Token amount parsed", { 
                inputAmount: amount,
                parsedAmount: parsedAmount.toString(),
                decimals
            });

            // Check balance
            const balance = await withRetry(() => erc20.balanceOf(wallet.address), 'balanceOf()');
            debugLog("Wallet balance check", {
                balance: ethers.formatUnits(balance, decimals),
                required: amount
            });

            if (balance < parsedAmount) {
                throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
            }

            // Check and approve if needed
            const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress), 'allowance()');
            debugLog("Allowance check", {
                currentAllowance: ethers.formatUnits(allowance, decimals),
                required: amount
            });

            if (allowance < parsedAmount) {
                debugLog("Initiating token approval");
                const approveTx = await withRetry(
                    () => erc20.approve(safeBridgeAddress, ethers.MaxUint256, gasParams),
                    'approve()',
                    10000
                );
                
                debugLog("Approval transaction sent", { txHash: approveTx.hash });
                
                await withRetry(
                    () => approveTx.wait(TRANSACTION_SETTINGS.blockConfirmation),
                    'approve confirmation'
                );
                
                debugLog("Approval confirmed");
            }

            debugLog(`Initiating bridge to ${destChain}`);
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

            debugLog("Bridge transaction initiated", { txHash: tx.hash });

            await withRetry(
                () => provider.waitForTransaction(tx.hash, TRANSACTION_SETTINGS.blockConfirmation),
                'transaction confirmation',
                15000
            );

            debugLog("Bridge transaction confirmed");
            return tx.hash;

        } catch (error) {
            debugLog("Transaction failed", {
                error: error.message,
                stack: error.stack,
                code: error.code,
                data: error.data
            });
            
            // Provide specific troubleshooting tips
            if (error.code === 'CALL_EXCEPTION') {
                debugLog("Troubleshooting tips", [
                    '1. Verify the bridge contract is operational',
                    '2. Check token approval status',
                    '3. Confirm contract addresses are correct'
                ]);
            }
            
            throw error;
        }
    }, 'sendToken');
};
