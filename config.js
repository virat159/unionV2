export const CHAINS = {
  SEPOLIA: 11155111,
  HOLESKY: 17000,
  BABYLON: 'babylon-testnet',
  XION: 'xion-testnet-1',
  CORN: 99999
};

export const RPC_URLS = {
  SEPOLIA: 'https://eth-sepolia.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB',
  HOLESKY: 'https://eth-holesky.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB',
  BABYLON: 'https://babylon-testnet-rpc.polkachu.com',
  XION: 'https://xion-testnet-rpc.polkachu.com',
  CORN: 'https://rpc.ankr.com/corn_testnet'
};

export const RPC_FALLBACKS = {
  SEPOLIA: [
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia.publicnode.com',
    'https://sepolia.drpc.org'
  ],
  HOLESKY: [
    'https://rpc.holesky.ethpandaops.io',
    'https://ethereum-holesky.publicnode.com'
  ],
  BABYLON: [
    'https://rpc.babylonchain.io'
  ],
  XION: [
    'https://xion-testnet-rpc.kingnodes.com'
  ],
  CORN: [
    'https://corn-testnet.rpc.caldera.xyz'
  ]
};

export const TOKENS = {
  WETH: {
    SEPOLIA: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', // Updated WETH contract
    HOLESKY: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91'
  },
  USDC: {
    SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    XION: 'xion1336jj8ertl8h7rdvnz4dh5rqahd09cy0x43guhsxx6xyrztx292qlzhdk9'
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
  SEPOLIA: '0x3f4B6664338F23d2397c953f2AB4Ce8031663f80', // Verified bridge
  HOLESKY: '0x2D1a8743a134126754b52Ee64843C37C133bA18a',
  BABYLON: '0x1234567890123456789012345678901234567890',
  XION: 'xion1v7vpe94u8qj2m4h6w5p3v6v7v8k9j0k1j2k3j4k5j6k7j8k9j0k1j2k3j4',
  CORN: '0x1234567890123456789012345678901234567890'
};

export const EXPLORERS = {
  SEPOLIA: 'https://sepolia.etherscan.io',
  HOLESKY: 'https://holesky.etherscan.io',
  BABYLON: 'https://babylon-testnet-explorer.com',
  XION: 'https://explorer.xion-testnet-1.burnt.com',
  CORN: 'https://explorer.corn-testnet.io'
};

export const GAS_SETTINGS = {
  defaultGasLimit: 100000,  // Increased from 35,000 to handle bridge complexity
  maxFeeMultiplier: 1.2,    // Reduced to 20% buffer
  maxPriorityFeeMultiplier: 1.2, // Reduced to 20% buffer
  retryDelay: 5000          // Increased retry delay
};

export const RPC_TIMEOUTS = {
  connection: 15000,    // Increased timeout
  request: 30000        // Increased timeout
};

export const TRANSACTION_SETTINGS = {
  maxRetries: 5,                   // Increased retry attempts
  confirmationTimeout: 120000,      // Increased to 120 seconds
  blockConfirmation: 2             // Require 2 confirmations
};

// New: Bridge-specific settings
export const BRIDGE_SETTINGS = {
  minApprovalAmount: ethers.parseUnits("1000", "ether"), // Large approval amount
  timeout: 300000 // 5 minute timeout for bridge operations
};
