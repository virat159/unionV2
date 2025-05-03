// Chain IDs (confirm with Union's docs)
const CHAINS = {
  XION: 'xion-testnet-1',
  BABYLON: 'babylon-testnet',
  HOLESKY: 17000,
  SEPOLIA: 11155111,
  CORN: 99999, // Confirm Corn chain ID
};

// Union V2 Contract Addresses (update per chain)
const UNION_CONTRACT = {
  HOLESKY: '0xUnionV2AddressOnHolesky', // Replace with actual address
  XION: 'xion1unioncontract...',        // Replace with actual address
};

// RPC URLs
const RPC_URLS = {
  HOLESKY: 'https://rpc.holesky.ethpandaops.io',
  SEPOLIA: 'https://rpc.sepolia.org',
  XION: 'https://xion-testnet-rpc.polkachu.com',
  CORN: 'https://corn-testnet-rpc.example.com' // Replace with actual RPC
};

module.exports = { CHAINS, UNION_CONTRACT, RPC_URLS };
