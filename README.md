# Union V2 Transaction Bot 🤖

Automates cross-chain transfers on Union V2 testnet.

## Routes Supported
- XION → Babylon
- Holesky → Xion (WETH)
- Corn → Babylon (WBTCN)
- Sepolia → Holesky (WETH/LINK)

## Setup
1. Install dependencies:
   ```bash
   npm install ethers axios dotenv
   ```
2. Add GitHub Secrets:
   - Go to Settings → Secrets → Actions
   - Add `PRIVATE_KEY` with your testnet wallet key

## Run Scripts
Manually trigger workflows in the **Actions** tab.

## Notes
- Update `config.js` with real contract addresses.
- Never commit `.env` files!
