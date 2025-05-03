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

                // Test connection with timeout
                await Promise.race([
                    provider.getBlockNumber(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('RPC timeout')), RPC_TIMEOUTS.request)
                    )
                ]);
                
                providerCache.set(chainId, provider);
                return provider;
            } catch (error) {
                console.warn(`RPC ${url} failed:`, error.message);
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
    try {
        const feeData = await provider.getFeeData();
        
        // Handle cases where fee data might be undefined or incomplete
        const maxFeePerGas = feeData.maxFeePerGas 
            ? feeData.maxFeePerGas.mul(GAS_SETTINGS.maxFeeMultiplier * 100).div(100)
            : ethers.parseUnits('50', 'gwei'); // Default value if maxFeePerGas is unavailable
        
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas 
            ? feeData.maxPriorityFeePerGas.mul(GAS_SETTINGS.maxPriorityFeeMultiplier * 100).div(100)
            : ethers.parseUnits('2', 'gwei'); // Default value if maxPriorityFeePerGas is unavailable
        
        return {
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasLimit: GAS_SETTINGS.defaultGasLimit
        };
    } catch (error) {
        console.warn('Failed to get fee data, using defaults:', error);
        return {
            maxFeePerGas: ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
            gasLimit: GAS_SETTINGS.defaultGasLimit
        };
    }
};

const withRetry = async (fn, operation = 'operation') => {
    let lastError;
    for (let i = 0; i < TRANSACTION_SETTINGS.maxRetries; i++) {
        try {
            console.log(`Attempt ${i+1}/${TRANSACTION_SETTINGS.maxRetries} for ${operation}`);
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < TRANSACTION_SETTINGS.maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, GAS_SETTINGS.retryDelay));
            }
        }
    }
    throw lastError;
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
    return withRetry(async () => {
        try {
            // Validate chains
            if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
                throw new Error(`Invalid chain: ${sourceChain} → ${destChain}`);
            }

            const provider = await getProvider(sourceChain);
            const wallet = new ethers.Wallet(privateKey, provider);
            const gasParams = await getGasParams(provider);

            // Get bridge address with validation
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
            const tokenAddress = getSafeAddress(asset || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9');
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

            // Check and approve if needed
            const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress), 'allowance()');
            if (allowance < parsedAmount) {
                console.log('⏳ Approving token transfer...');
                const approveTx = await withRetry(() => 
                    erc20.approve(safeBridgeAddress, parsedAmount, gasParams),
                    'approve()'
                );
                await withRetry(() => approveTx.wait(), 'approve wait');
            }

            console.log(`⏳ Bridging to ${destChain}...`);
            const bridge = new ethers.Contract(
                safeBridgeAddress,
                ['function depositERC20(address token, uint256 amount, uint16 destChainId)'],
                wallet
            );

            const tx = await withRetry(() => 
                bridge.depositERC20(
                    tokenAddress,
                    parsedAmount,
                    CHAINS[destChain],
                    gasParams
                ),
                'depositERC20'
            );

            // Wait for confirmation
            await withRetry(() => 
                provider.waitForTransaction(tx.hash, TRANSACTION_SETTINGS.blockConfirmation),
                'transaction confirmation'
            );

            return tx.hash;

        } catch (error) {
            console.error('❌ Transaction failed:', {
                sourceChain,
                destChain,
                asset,
                amount,
                reason: error.reason || error.message,
                code: error.code,
                stack: error.stack
            });
            throw error;
        }
    }, 'sendToken');
};
