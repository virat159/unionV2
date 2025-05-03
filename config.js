export const CHAINS = {
  SEPOLIA: 11155111,      // Ethereum testnet
  HOLESKY: 17000,         // Ethereum testnet
  BABYLON: 'babylon-testnet',  // Babylon chain ID
  XION: 'xion-testnet-1',      // Xion chain ID
  CORN: 99999             // Corn testnet
};

export const RPC_URLS = {
  SEPOLIA: 'https://rpc.sepolia.org',                    // Sepolia RPC
  HOLESKY: 'https://rpc.holesky.ethpandaops.io',         // Holesky RPC
  BABYLON: 'https://babylon-testnet-rpc.polkachu.com',   // Babylon RPC
  XION: 'https://xion-testnet-rpc.polkachu.com',         // Xion RPC
  CORN: 'https://rpc.ankr.com/corn_testnet'              // Corn RPC
};

export const TOKENS = {
  WETH: {
    // Wrapped Ether contracts
    SEPOLIA: '0x5FbE74A283f7954f10AA04C2eDf55578811aeb03',  // Verified Sepolia WETH
    HOLESKY: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91'   // Official Holesky WETH
  },
  USDC: {
    // USD Coin contracts
    SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',  // Sepolia USDC
    XION: 'xion1336jj8ertl8h7rdvnz4dh5rqahd09cy0x43guhsxx6xyrztx292qlzhdk9'  // Xion USDC
  }
};

export const UNION_CONTRACT = {
  // Union Protocol bridge contracts
  SEPOLIA: '0x3f4B6664338f23d2397c953f2Ab4Ce8031663f80',    // Sepolia bridge
  HOLESKY: '0x2D1a8743a134126754b52Ee64843C37C133bA18a',    // Holesky bridge
  BABYLON: '0x0000000000000000000000000000000000000000',    // Placeholder - update when available
  XION: 'xion0000000000000000000000000000000000000000000',  // Placeholder - update when available
  CORN: '0x0000000000000000000000000000000000000000'        // Placeholder - update when available
};
