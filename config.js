export const CHAINS = {
  SEPOLIA: 11155111,
  HOLESKY: 17000,
  BABYLON: 'babylon-testnet',
  XION: 'xion-testnet-1',
  CORN: 99999 // Keep existing
};

export const RPC_URLS = {
  SEPOLIA: 'https://rpc.sepolia.org',
  HOLESKY: 'https://rpc.holesky.ethpandaops.io',
  BABYLON: 'https://babylon-testnet-rpc.polkachu.com',
  XION: 'https://xion-testnet-rpc.polkachu.com',
  CORN: 'https://rpc.ankr.com/corn_testnet' // Keep existing
};

export const TOKENS = {
  WETH: {
    SEPOLIA: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9', // Verified Sepolia WETH
    HOLESKY: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91' // Verified Holesky WETH
  },
  USDC: {
    SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Keep existing
    XION: 'xion1336jj8ertl8h7rdvnz4dh5rqahd09cy0x43guhsxx6xyrztx292qlzhdk9' // Keep existing
  }
};

export const UNION_CONTRACT = {
  SEPOLIA: '0x3E2b53b2F6c7C3A7B1f5d65C07D5D6D0E1f3B3a2', // Updated Sepolia Union
  HOLESKY: '0x8aB5B3f1B3F4cD3aDf5F10aDd7a5E3fB3a1Dd7f', // Updated Holesky Union
  // Other chains remain unchanged
};
