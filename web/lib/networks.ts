export interface NetworkConfig {
  id: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  storageIndexer: string;
  explorer: string;
  storageScan: string;
  inftAddress: string;
  registryAddress: string;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    name: "0G Mainnet",
    chainId: 16661,
    rpcUrl: "https://evmrpc.0g.ai",
    storageIndexer: "https://indexer-storage-turbo.0g.ai",
    explorer: "https://chainscan.0g.ai",
    storageScan: "https://storagescan.0g.ai",
    inftAddress: "0xcfee7588d1C396fa76d1D7f6f2BBC50153775785",
    registryAddress: "0xd0565f93f450494e8373dE7f33d565E0B5b41089",
  },
  testnet: {
    id: "testnet",
    name: "0G Testnet",
    chainId: 16602,
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
    explorer: "https://chainscan-galileo.0g.ai",
    storageScan: "https://storagescan-galileo.0g.ai",
    inftAddress: "0xcfee7588d1C396fa76d1D7f6f2BBC50153775785",
    registryAddress: "0xd0565f93f450494e8373dE7f33d565E0B5b41089",
  },
};

export const DEFAULT_NETWORK = "mainnet";

export function getNetwork(id?: string): NetworkConfig {
  return NETWORKS[id || DEFAULT_NETWORK] || NETWORKS[DEFAULT_NETWORK];
}
