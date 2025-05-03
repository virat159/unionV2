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
    // Enforce minimum gas prices (2.5 Gwei max, 2 Gwei priority)
    const MIN_BASE_FEE = ethers.parseUnits("2.5", "gwei");
    const MIN_PRIORITY_FEE = ethers.parseUnits("2", "gwei");
    
    try {
        const feeData = await provider.getFeeData();
        
        // Use network fees if higher than minimums, otherwise use minimums
        const baseFee = (feeData.gasPrice || feeData.maxFeePerGas) > MIN_BASE_FEE 
            ? (feeData.gasPrice || feeData.maxFeePerGas)
            : MIN_BASE_FEE;

        const priorityFee = feeData.maxPriorityFeePerGas > MIN_PRIORITY_FEE
            ? feeData.maxPriorityFeePerGas
            : MIN_PRIORITY_FEE;

        // Ensure maxFee >= priorityFee + 10% buffer
        const maxPriorityFeePerGas = priorityFee;
        const maxFeePerGas = baseFee > (priorityFee * 110n / 100n)
            ? baseFee
            : (priorityFee * 110n / 100n);

        return {
            maxFeePerGas,
            maxPriorityFeePerGas,
            gasLimit: GAS_SETTINGS.defaultGasLimit
        };
    } catch (error) {
        console.warn('Using enforced minimum gas prices:', error);
        return {
            maxFeePerGas: MIN_BASE_FEE,
            maxPriorityFeePerGas: MIN_PRIORITY_FEE,
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

            // Verify gas parameters meet minimum requirements
            if (gasParams.maxFeePerGas < ethers.parseUnits("2.5", "gwei") ||
                gasParams.maxPriorityFeePerGas < ethers.parseUnits("2", "gwei")) {
                throw new Error('Calculated gas fees below minimum requirements');
            }

            console.log('Gas parameters:', {
                maxFeePerGas: ethers.formatUnits(gasParams.maxFeePerGas, 'gwei'),
                maxPriorityFeePerGas: ethers.formatUnits(gasParams.maxPriorityFeePerGas, 'gwei'),
                gasLimit: gasParams.gasLimit
            });

            // Get bridge address with validation
            const bridgeAddress = UNION_CONTRACT[sourceChain];
            if (!bridgeAddress || bridgeAddress.startsWith('0x000')) {
                throw new Error(`Missing bridge address for ${sourceChain}`);
            }
            const safeBridgeAddress = getSafeAddress(bridgeAddress);

            // Add bridge contract checks
            const bridge = new ethers.Contract(
                safeBridgeAddress,
                [
                    'function paused() view returns (bool)',
                    'function allowedTokens(address) view returns (bool)',
                    'function supportsChain(uint16) view returns (bool)'
                ],
                provider
            );

            const [isPaused, isTokenAllowed, isChainSupported] = await Promise.all([
                bridge.paused(),
                bridge.allowedTokens(TOKENS.WETH[sourceChain]),
                bridge.supportsChain(CHAINS[destChain])
            ]);

            if (isPaused) throw new Error('Bridge contract is paused');
            if (!isTokenAllowed) throw new Error('Token not allowed by bridge');
            if (!isChainSupported) throw new Error('Destination chain not supported');

            // Handle native ETH transfers
            const isNative = asset === 'native' || asset === 'NATIVE';
            if (isNative) {
                const nativeBridge = new ethers.Contract(
                    safeBridgeAddress,
                    ['function depositNative(uint16 destChainId) payable'],
                    wallet
                );
                
                const tx = await nativeBridge.depositNative(
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
                ? '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9' // Sepolia WETH
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

            // Check and approve if needed
            const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress), 'allowance()');
            if (allowance < parsedAmount) {
                console.log('⏳ Approving token transfer...');
                const approveTx = await withRetry(() => 
                    erc20.approve(safeBridgeAddress, ethers.MaxUint256, gasParams), // Approve max amount
                    'approve()'
                );
                await withRetry(() => approveTx.wait(TRANSACTION_SETTINGS.blockConfirmation), 'approve wait');
            }

            console.log(`⏳ Bridging to ${destChain}...`);
            const tokenBridge = new ethers.Contract(
                safeBridgeAddress,
                ['function depositERC20(address token, uint256 amount, uint16 destChainId)'],
                wallet
            );

            const tx = await withRetry(() => 
                tokenBridge.depositERC20(
                    tokenAddress,
                    parsedAmount,
                    CHAINS[destChain],
                    {
                        ...gasParams,
                        gasLimit: 150000 // Slightly higher gas limit for token transfers
                    }
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
