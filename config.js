import { ethers } from 'ethers';

// Chain IDs
export const CHAINS = {
  SEPOLIA: 11155111,
  HOLESKY: 17000,
  BABYLON: 'babylon-testnet',
  XION: 'xion-testnet-1',
  CORN: 99999
};

// RPC Endpoints
export const RPC_URLS = {
  SEPOLIA: 'https://eth-sepolia.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB',
  HOLESKY: 'https://eth-holesky.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB',
  BABYLON: 'https://babylon-testnet-rpc.polkachu.com',
  XION: 'https://xion-testnet-rpc.polkachu.com',
  CORN: 'https://rpc.ankr.com/corn_testnet'
};

// Fallback RPCs
export const RPC_FALLBACKS = {
  SEPOLIA: [
    'https://rpc.sepolia.org',
    'https://ethereum-sepolia.publicnode.com'
  ],
  HOLESKY: [
    'https://rpc.holesky.ethpandaops.io'
  ],
  BABYLON: [
    'https://rpc.babylonchain.io'
  ]
};

// Token Contracts
export const TOKENS = {
  WETH: {
    SEPOLIA: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
    HOLESKY: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91'
  },
  USDC: {
    SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    XION: 'xion1336jj8ertl8h7rdvnz4dh5rqahd09cy0x43guhsxx6xyrztx292qlzhdk9'
  }
};

// Bridge Contracts (UPDATED)
export const UNION_CONTRACT = {
  SEPOLIA: '0x5FbE74A283f7954f10AA04C2eDf55578811aeb03', // Corrected address
  HOLESKY: '0x2D1a8743a134126754b52Ee64843C37C133bA18a'
};

// Block Explorers
export const EXPLORERS = {
  SEPOLIA: 'https://sepolia.etherscan.io',
  HOLESKY: 'https://holesky.etherscan.io'
};

// Gas Settings (OPTIMIZED)
export const GAS_SETTINGS = {
  defaultGasLimit: 300000, // Reduced from 350000 to match successful manual TX
  minMaxFeePerGas: ethers.parseUnits("2", "gwei"), // Reduced from 3 gwei
  minPriorityFee: ethers.parseUnits("1.5", "gwei"), // Reduced from 2.5 gwei
  retryDelay: 5000,
  maxFeeBuffer: 1.2,
  maxPriorityBuffer: 1.1
};

// Network Timeouts
export const RPC_TIMEOUTS = {
  connection: 15000,
  request: 30000
};

// Transaction Settings
export const TRANSACTION_SETTINGS = {
  maxRetries: 5,
  confirmationTimeout: 120000,
  blockConfirmations: 2
};

// Bridge Settings
export const BRIDGE_SETTINGS = {
  minApprovalAmount: ethers.parseUnits("1000", "ether"),
  operationTimeout: 300000
};
