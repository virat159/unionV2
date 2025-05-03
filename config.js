export const CHAINS = {
  SEPOLIA: 11155111,
  HOLESKY: 17000,
  BABYLON: 'babylon-testnet',
  XION: 'xion-testnet-1',
  CORN: 99999
};

export const RPC_URLS = {
  SEPOLIA: 'https://rpc.sepolia.org',
  HOLESKY: 'https://rpc.holesky.ethpandaops.io',
  BABYLON: 'https://babylon-testnet-rpc.polkachu.com',
  XION: 'https://xion-testnet-rpc.polkachu.com',
  CORN: 'https://rpc.ankr.com/corn_testnet'
};

export const TOKENS = {
  WETH: {
    SEPOLIA: '0x5FbE74A283f7954f10AA04C2eDf55578811aeb03', // Verified from tx
    HOLESKY: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91' // Official Holesky WETH
  },
  USDC: {
    SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    XION: 'xion1336jj8ertl8h7rdvnz4dh5rqahd09cy0x43guhsxx6xyrztx292qlzhdk9'
  }
};

export const UNION_CONTRACT = {
  SEPOLIA: '0x3f4B6664338f23d2397c953f2Ab4Ce8031663f80', // From tx data
  HOLESKY: '0x2D1a8743a134126754b52Ee64843C37C133bA18a', // From tx data
  BABYLON: '0x...', // Add if needed
  XION: 'xion1...', // Add if needed
  CORN: '0x...' // Add if needed
};
