export const CHAINS = {
  SEPOLIA: 11155111,      // Ethereum testnet
  HOLESKY: 17000,         // Ethereum testnet
  BABYLON: 'babylon-testnet',  // Babylon chain ID
  XION: 'xion-testnet-1',      // Xion chain ID
  CORN: 99999             // Corn testnet
};

// Updated with reliable RPC endpoints
export const RPC_URLS = {
  SEPOLIA: 'https://eth-sepolia.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB', // Primary Alchemy
  HOLESKY: 'https://eth-holesky.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB', // Primary Alchemy
  BABYLON: 'https://babylon-testnet-rpc.polkachu.com',
  XION: 'https://xion-testnet-rpc.polkachu.com',
  CORN: 'https://rpc.ankr.com/corn_testnet'
};

// Enhanced fallback RPCs with proven reliability
export const RPC_FALLBACKS = {
  SEPOLIA: [
    'https://rpc.sepolia.org',                  // Official Sepolia RPC
    'https://sepolia.drpc.org',                 // DRPC endpoint
    'https://ethereum-sepolia.publicnode.com',  // PublicNode
    'https://rpc2.sepolia.org'                  // Secondary Sepolia RPC
  ],
  HOLESKY: [
    'https://rpc.holesky.ethpandaops.io',       // Official Holesky RPC
    'https://holesky.drpc.org',                 // DRPC endpoint
    'https://ethereum-holesky.publicnode.com'   // PublicNode
  ],
  BABYLON: [
    'https://rpc.babylonchain.io',              // Official Babylon RPC
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

export const TOKENS = {
  WETH: {
    SEPOLIA: '0x5FbE74A283f7954f10AA04C2eDf55578811aeb03',  // Verified Sepolia WETH
    HOLESKY: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91'   // Official Holesky WETH
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

export const UNION_CONTRACT = {
  SEPOLIA: '0x3f4B6664338f23d2397c953f2Ab4Ce8031663f80',    // Sepolia bridge
  HOLESKY: '0x2D1a8743a134126754b52Ee64843C37C133bA18a',    // Holesky bridge
  BABYLON: '0x1234567890123456789012345678901234567890',    // Updated placeholder
  XION: 'xion1v7vpe94u8qj2m4h6w5p3v6v7v8k9j0k1j2k3j4k5j6k7j8k9j0k1j2k3j4',  // Updated format
  CORN: '0x1234567890123456789012345678901234567890'        // Updated placeholder
};

export const EXPLORERS = {
  SEPOLIA: 'https://sepolia.etherscan.io',
  HOLESKY: 'https://holesky.etherscan.io',
  BABYLON: 'https://babylon-testnet.explorer.com',
  XION: 'https://testnet.explorer.xion.xyz',
  CORN: 'https://testnet.corn.explorer'
};

export const GAS_SETTINGS = {
  defaultGasLimit: 400000,  // Increased for complex transactions
  maxFeeMultiplier: 1.5,    // 50% buffer for max fee
  maxPriorityFeeMultiplier: 2, // 100% buffer for priority fee
  retryDelay: 4000          // Optimal retry timing
};

export const RPC_TIMEOUTS = {
  connection: 8000,    // 8 seconds for initial connection
  request: 15000       // 15 seconds for regular requests
};

// Additional reliability settings
export const TRANSACTION_SETTINGS = {
  maxRetries: 5,                   // Maximum transaction retries
  confirmationTimeout: 60000,      // 60 seconds for tx confirmation
  blockConfirmation: 2             // Number of blocks to wait for confirmation
};
