/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_RPC_URL: process.env.RPC_URL || "https://evmrpc-testnet.0g.ai",
    NEXT_PUBLIC_INFT_ADDRESS: process.env.INFT_CONTRACT_ADDRESS || "",
    NEXT_PUBLIC_REGISTRY_ADDRESS: process.env.MEMORY_REGISTRY_ADDRESS || "",
    NEXT_PUBLIC_MARKETPLACE_ADDRESS: process.env.MARKETPLACE_ADDRESS || "",
    NEXT_PUBLIC_STORAGE_INDEXER: process.env.STORAGE_INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai",
    NEXT_PUBLIC_CHAIN_ID: process.env.CHAIN_ID || "16602",
  },
};
