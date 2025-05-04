import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, RPC_FALLBACKS, UNION_CONTRACT, TOKENS, GAS_SETTINGS, RPC_TIMEOUTS, TRANSACTION_SETTINGS } from './config.js';

const providerCache = new Map();

export const getProvider = async (chainId) => {
    if (!providerCache.has(chainId)) {
        const endpoints = [
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

                await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`RPC timeout after ${RPC_TIMEOUTS.request}ms`)), RPC_TIMEOUTS.request)
                    )
                ]);
                
                providerCache.set(chainId, provider);
                return provider;
            } catch (error) {
                console.warn(`RPC endpoint failed (${url}):`, error.message);
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
    const MIN_BASE_FEE = ethers.parseUnits("10", "gwei"); // Updated from 3
    const MIN_PRIORITY_FEE = ethers.parseUnits("9.5", "gwei"); // Updated from 2.5
    
    try {
        const feeData = await provider.getFeeData();
        
        // Always use our minimums (override network suggestions)
        const maxPriorityFeePerGas = MIN_PRIORITY_FEE;
        const maxFeePerGas = MIN_BASE_FEE;
        
        return {
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasLimit: GAS_SETTINGS.defaultGasLimit || 500000 // Use 500k if not set
        };
    } catch (error) {
        console.warn('Using enforced gas prices:', error.message);
        return {
            maxFeePerGas: MIN_BASE_FEE,
            maxPriorityFeePerGas: MIN_PRIORITY_FEE,
            gasLimit: 500000
        };
    }
};

const withRetry = async (fn, operation = 'operation', customDelay = null) => {
    let lastError;
    for (let i = 0; i < TRANSACTION_SETTINGS.maxRetries; i++) {
        try {
            const delay = i > 0 ? (customDelay || GAS_SETTINGS.retryDelay) : 0;
            if (delay > 0) {
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            console.log(`Attempt ${i+1}/${TRANSACTION_SETTINGS.maxRetries} for ${operation}`);
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < TRANSACTION_SETTINGS.maxRetries - 1) {
                console.warn(`Attempt ${i+1} failed:`, error.message);
            }
        }
    }
    console.error(`All attempts failed for ${operation}`);
    throw lastError;
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey, gasSettings }) => {
    return withRetry(async () => {
        try {
            // Validate input parameters
            if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
                throw new Error(`Invalid chain: ${sourceChain} → ${destChain}`);
            }
            if (!privateKey || !privateKey.trim()) {
                throw new Error('Invalid private key');
            }

            const provider = await getProvider(sourceChain);
            const wallet = new ethers.Wallet(privateKey, provider);
            
            // ENFORCE 10/9.5 GWEI HERE
            const gasParams = {
                maxFeePerGas: ethers.parseUnits("10", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("9.5", "gwei"),
                gasLimit: 500000
            };

            console.log('Enforced gas parameters:', {
                maxFeePerGas: '10 Gwei',
                maxPriorityFeePerGas: '9.5 Gwei',
                gasLimit: gasParams.gasLimit
            });

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
                ? '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'
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

            const decimals = await withRetry(() => erc20.decimals().catch(() => 18), 'decimals()');
            const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

            const balance = await withRetry(() => erc20.balanceOf(wallet.address), 'balanceOf()');
            if (balance < parsedAmount) {
                throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
            }

            const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress), 'allowance()');
            if (allowance < parsedAmount) {
                console.log('⏳ Approving token transfer...');
                const approveTx = await withRetry(
                    () => erc20.approve(safeBridgeAddress, ethers.MaxUint256, gasParams),
                    'approve()',
                    10000
                );
                await withRetry(
                    () => approveTx.wait(TRANSACTION_SETTINGS.blockConfirmation),
                    'approve confirmation'
                );
            }

            console.log(`⏳ Bridging to ${destChain}...`);
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
                    gasParams // Using our enforced gas params
                ),
                'depositERC20'
            );

            await withRetry(
                () => provider.waitForTransaction(tx.hash, TRANSACTION_SETTINGS.blockConfirmation),
                'transaction confirmation',
                15000
            );

            return tx.hash;

        } catch (error) {
            console.error('Transaction failed:', error.message);
            throw error;
        }
    }, 'sendToken');
};
