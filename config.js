export const CHAINS = {
  SEPOLIA: 11155111,      // Ethereum testnet
  HOLESKY: 17000,         // Ethereum testnet
  BABYLON: 'babylon-testnet',  // Babylon chain ID
  XION: 'xion-testnet-1',      // Xion chain ID
  CORN: 99999             // Corn testnet
};

// Optimized RPC endpoints with priority ordering
export const RPC_URLS = {
  SEPOLIA: 'https://eth-sepolia.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB', // Primary
  HOLESKY: 'https://eth-holesky.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB', // Primary
  BABYLON: 'https://babylon-testnet-rpc.polkachu.com',  // 1st choice
  XION: 'https://xion-testnet-rpc.polkachu.com',        // 1st choice
  CORN: 'https://rpc.ankr.com/corn_testnet'             // 1st choice
};

// Tiered fallback RPCs (will be tried in order)
export const RPC_FALLBACKS = {
  SEPOLIA: [
    'https://rpc.sepolia.org',                  // Official
    'https://ethereum-sepolia.publicnode.com',  // Reliable
    'https://sepolia.drpc.org',                 // DRPC
    'https://rpc2.sepolia.org'                  // Secondary
  ],
  HOLESKY: [
    'https://rpc.holesky.ethpandaops.io',       // Official
    'https://ethereum-holesky.publicnode.com',  // Reliable
    'https://holesky.drpc.org'                  // DRPC
  ],
  BABYLON: [
    'https://rpc.babylonchain.io',              // Official
    'https://babylon-testnet-rpc.kingnodes.com' // KingNodes
  ],
  XION: [
    'https://xion-testnet-rpc.kingnodes.com',   // KingNodes
    'https://xion-testnet-rpc.polkachu.com'     // Polkachu
  ],
  CORN: [
    'https://corn-testnet.rpc.caldera.xyz',     // Caldera
    'https://rpc.ankr.com/corn_testnet'         // Ankr
  ]
};

// Verified token contracts (updated 2024)
export const TOKENS = {
  WETH: {
    SEPOLIA: '0xdd13E55209Fd76AfE204dBda4007C227904f0a81',  // Verified WETH
    HOLESKY: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91'   // Official WETH
  },
  USDC: {
    SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',  // Sepolia USDC
    XION: 'xion1336jj8ertl8h7rdvnz4dh5rqahd09cy0x43guhsxx6xyrztx292qlzhdk9'  // Xion USDC
  },
  NATIVE: {
    SEPOLIA: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    HOLESKY: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    BABYLON: 'native',
    XION: 'uxion',
    CORN: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
  }
};

// Verified bridge contracts
export const UNION_CONTRACT = {
  SEPOLIA: '0x3f4B6664338f23d2397c953f2Ab4Ce8031663f80',    // Sepolia bridge
  HOLESKY: '0x2D1a8743a134126754b52Ee64843C37C133bA18a',    // Holesky bridge
  BABYLON: '0x1234567890123456789012345678901234567890',    // Placeholder
  XION: 'xion1v7vpe94u8qj2m4h6w5p3v6v7v8k9j0k1j2k3j4k5j6k7j8k9j0k1j2k3j4',  // Xion format
  CORN: '0x1234567890123456789012345678901234567890'        // Placeholder
};

// Block explorers
export const EXPLORERS = {
  SEPOLIA: 'https://sepolia.etherscan.io',
  HOLESKY: 'https://holesky.etherscan.io',
  BABYLON: 'https://babylon-testnet-explorer.com',
  XION: 'https://explorer.xion-testnet-1.burnt.com',
  CORN: 'https://explorer.corn-testnet.io'
};

// Optimized gas settings
export const GAS_SETTINGS = {
  defaultGasLimit: 350000,  // Safe default for most operations
  maxFeeMultiplier: 1.3,    // 30% buffer recommended
  maxPriorityFeeMultiplier: 1.5, // 50% buffer recommended
  retryDelay: 3500          // Optimal retry timing
};

// Network timeouts
export const RPC_TIMEOUTS = {
  connection: 10000,    // 10 seconds for initial connection
  request: 20000        // 20 seconds for regular requests
};

// Transaction handling
export const TRANSACTION_SETTINGS = {
  maxRetries: 4,                   // Optimal retry count
  confirmationTimeout: 90000,      // 90 seconds for confirmation
  blockConfirmation: 1             // 1 block confirmation for testnets
};
