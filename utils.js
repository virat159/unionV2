import { ethers } from 'ethers';
import { CHAINS, RPC_URLS, RPC_FALLBACKS, UNION_CONTRACT, TOKENS, GAS_SETTINGS, RPC_TIMEOUTS } from './config.js';

const providerCache = new Map();

export const getProvider = async (chainId) => {
    if (!providerCache.has(chainId)) {
        // Combine all RPC endpoints (primary + fallbacks)
        const endpoints = [
            RPC_URLS[chainId],
            ...(RPC_FALLBACKS[chainId] || [])
        ].filter(Boolean);

        for (const url of endpoints) {
            try {
                const provider = new ethers.JsonRpcProvider(url, {
                    chainId: Number(CHAINS[chainId]),
                    name: chainId.toLowerCase(),
                    timeout: RPC_TIMEOUTS.connection
                });

                // Verify connection works
                await provider.getBlockNumber();
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
    if (typeof address !== 'string') return address;
    
    // Skip validation for non-EVM addresses (Xion format)
    if (address.startsWith('xion')) return address;

    try {
        return ethers.getAddress(address);
    } catch {
        try {
            return ethers.getAddress(address.toLowerCase());
        } catch {
            console.warn(`Could not checksum address: ${address}, using raw`);
            return address;
        }
    }
};

const getGasParams = async (provider) => {
    try {
        const feeData = await provider.getFeeData();
        return {
            maxFeePerGas: feeData.maxFeePerGas?.mul(Math.floor(GAS_SETTINGS.maxFeeMultiplier * 100)).div(100) 
                ?? ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.mul(Math.floor(GAS_SETTINGS.maxPriorityFeeMultiplier * 100)).div(100)
                ?? ethers.parseUnits('2', 'gwei'),
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

const withRetry = async (fn, retries = 3, delay = GAS_SETTINGS.retryDelay) => {
    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
};

export const sendToken = async ({ sourceChain, destChain, asset, amount, privateKey }) => {
    return withRetry(async () => {
        try {
            if (!CHAINS[sourceChain] || !CHAINS[destChain]) {
                throw new Error(`Invalid chain: ${sourceChain} → ${destChain}`);
            }

            const provider = await getProvider(sourceChain);
            const wallet = new ethers.Wallet(privateKey, provider);
            const gasParams = await getGasParams(provider);

            const bridgeAddress = UNION_CONTRACT[sourceChain];
            if (!bridgeAddress || bridgeAddress.startsWith('0x000')) {
                throw new Error(`Missing bridge address for ${sourceChain}`);
            }
            const safeBridgeAddress = getSafeAddress(bridgeAddress);

            // Handle native transfers
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

            // Handle token transfers
            const tokenAddress = getSafeAddress(asset);
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

            const decimals = await withRetry(() => erc20.decimals().catch(() => 18));
            const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

            // Check balance
            const balance = await withRetry(() => erc20.balanceOf(wallet.address));
            if (balance < parsedAmount) {
                throw new Error(`Insufficient balance. Need ${amount}, has ${ethers.formatUnits(balance, decimals)}`);
            }

            // Check and approve if needed
            const allowance = await withRetry(() => erc20.allowance(wallet.address, safeBridgeAddress));
            if (allowance < parsedAmount) {
                console.log('⏳ Approving token transfer...');
                const approveTx = await withRetry(() => 
                    erc20.approve(safeBridgeAddress, parsedAmount, gasParams)
                );
                await withRetry(() => approveTx.wait());
            }

            console.log(`⏳ Bridging to ${destChain}...`);
            const bridge = new ethers.Contract(
                safeBridgeAddress,
                [
                    'function depositERC20(address token, uint256 amount, uint16 destChainId)',
                    'function depositNative(uint16 destChainId) payable'
                ],
                wallet
            );

            const tx = await withRetry(() => 
                bridge.depositERC20(
                    tokenAddress,
                    parsedAmount,
                    CHAINS[destChain],
                    gasParams
                )
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
    });
};
