const txHash = await sendToken({
    sourceChain: 'SEPOLIA',
    destChain: 'HOLESKY',
    asset: TOKENS.WETH.SEPOLIA,
    amount: 0.0001,
    privateKey: 'your_private_key'
});
console.log('Transaction hash:', txHash);
