import { HardhatUserConfig } from "hardhat/config";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: { evmVersion: "cancun" },
  },
  paths: {
    sources: "./contracts/src",
  },
  networks: {
    "0g-testnet": {
      url: "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    "0g-mainnet": {
      url: "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
