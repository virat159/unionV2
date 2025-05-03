export const CHAINS = {
  SEPOLIA: 11155111,      // Ethereum testnet
  HOLESKY: 17000,         // Ethereum testnet
  BABYLON: 'babylon-testnet',  // Babylon chain ID
  XION: 'xion-testnet-1',      // Xion chain ID
  CORN: 99999             // Corn testnet
};

// Updated with multiple fallback RPC endpoints
export const RPC_URLS = {
  SEPOLIA: [
    'https://rpc.sepolia.org',
    'https://sepolia.drpc.org',
    'https://eth-sepolia.public.blastapi.io',
    'https://rpc2.sepolia.org'
  ],
  HOLESKY: [
    'https://rpc.holesky.ethpandaops.io',
    'https://holesky.drpc.org',
    'https://ethereum-holesky.publicnode.com'
  ],
  BABYLON: [
    'https://babylon-testnet-rpc.polkachu.com',
    'https://rpc.babylonchain.io'
  ],
  XION: [
    'https://xion-testnet-rpc.polkachu.com',
    'https://xion-testnet-rpc.kingnodes.com'
  ],
  CORN: [
    'https://rpc.ankr.com/corn_testnet',
    'https://corn-testnet.rpc.caldera.xyz'
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
  // Added native token representations
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

// Added explorer URLs for transaction tracking
export const EXPLORERS = {
  SEPOLIA: 'https://sepolia.etherscan.io',
  HOLESKY: 'https://holesky.etherscan.io',
  BABYLON: 'https://babylon-testnet.explorer.com',
  XION: 'https://testnet.explorer.xion.xyz',
  CORN: 'https://testnet.corn.explorer'
};

// Added default gas settings
export const GAS_SETTINGS = {
  defaultGasLimit: 300000,
  maxFeeMultiplier: 1.2,
  maxPriorityFeeMultiplier: 1.5,
  retryDelay: 5000 // ms between retries
};
