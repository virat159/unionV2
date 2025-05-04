import { ethers } from 'ethers';

// Chain IDs (unchanged)
export const CHAINS = {
  SEPOLIA: 11155111,
  HOLESKY: 17000,
  BABYLON: 'babylon-testnet',
  XION: 'xion-testnet-1',
  CORN: 99999
};

// RPC Endpoints (unchanged)
export const RPC_URLS = {
  SEPOLIA: 'https://eth-sepolia.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB',
  HOLESKY: 'https://eth-holesky.g.alchemy.com/v2/GSQ458MB7rf3l9f7cPgntZ3txx9uOmwB',
  BABYLON: 'https://babylon-testnet-rpc.polkachu.com',
  XION: 'https://xion-testnet-rpc.polkachu.com',
  CORN: 'https://rpc.ankr.com/corn_testnet'
};

// Fallback RPCs (unchanged)
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

// Token Contracts (UPDATED)
export const TOKENS = {
  WETH: {
    SEPOLIA: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
    HOLESKY: '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91'
  },
  USDC: {
    SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    HOLESKY: '0x57978bfe465ad9b1c0bf80f6c1539d300705ea50',
    XION: 'xion1336jj8ertl8h7rdvnz4dh5rqahd09cy0x43guhsxx6xyrztx292qlzhdk9'
  }
};

// Bridge Contracts (unchanged)
export const UNION_CONTRACT = {
  SEPOLIA: '0x5FbE74A283f7954f10AA04C2eDf55578811aeb03',
  HOLESKY: '0x2D1a8743a134126754b52Ee64843C37C133bA18a'
};

// Block Explorers (unchanged)
export const EXPLORERS = {
  SEPOLIA: 'https://sepolia.etherscan.io',
  HOLESKY: 'https://holesky.etherscan.io'
};

// Gas Settings (UPDATED TO 10/9.5 GWEI)
export const GAS_SETTINGS = {
  defaultGasLimit: 500000,           // Increased for safety
  minMaxFeePerGas: ethers.parseUnits("10", "gwei"),    // Fixed 10 Gwei
  minPriorityFee: ethers.parseUnits("9.5", "gwei"),    // Fixed 9.5 Gwei
  retryDelay: 5000,
  maxFeeBuffer: 1.0,                // Disabled buffers
  maxPriorityBuffer: 1.0            // Disabled buffers
};

// Network Timeouts (unchanged)
export const RPC_TIMEOUTS = {
  connection: 15000,
  request: 30000
};

// Transaction Settings (unchanged)
export const TRANSACTION_SETTINGS = {
  maxRetries: 5,
  confirmationTimeout: 120000,
  blockConfirmations: 2
};

// Bridge Settings (unchanged)
export const BRIDGE_SETTINGS = {
  minApprovalAmount: ethers.parseUnits("1000", "ether"),
  operationTimeout: 300000
};

// New: Fee Validator
export const validateGasSettings = () => {
  console.log("Active Gas Settings:", {
    maxFee: ethers.formatUnits(GAS_SETTINGS.minMaxFeePerGas, "gwei") + " gwei",
    priorityFee: ethers.formatUnits(GAS_SETTINGS.minPriorityFee, "gwei") + " gwei",
    gasLimit: GAS_SETTINGS.defaultGasLimit
  });
};
