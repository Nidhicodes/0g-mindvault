export const INFT_ADDRESS = process.env.NEXT_PUBLIC_INFT_ADDRESS || "0xcfee7588d1C396fa76d1D7f6f2BBC50153775785";
export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "0xd0565f93f450494e8373dE7f33d565E0B5b41089";
export const MARKETPLACE_ADDRESS = process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://evmrpc.0g.ai";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "16661");
export const EXPLORER_URL = CHAIN_ID === 16661
  ? "https://chainscan.0g.ai"
  : "https://chainscan-galileo.0g.ai";
export const STORAGE_SCAN_URL = "https://storagescan-galileo.0g.ai";

export const INFT_ABI = [
  "function mintAgent(string name, string encryptedConfig) returns (uint256)",
  "function getAgent(uint256) view returns (string name, string storageRoot, string kvStreamId, string encryptedConfig, uint256 createdAt, uint256 updatedAt)",
  "function updateMemory(uint256 tokenId, string storageRoot, string kvStreamId)",
  "function totalAgents() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function cloneAgent(uint256 originalId) returns (uint256)",
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, string name)",
  "event MemoryUpdated(uint256 indexed tokenId, string storageRoot, string kvStreamId)",
  "event AgentCloned(uint256 indexed originalId, uint256 indexed cloneId, address indexed newOwner)",
] as const;

export const REGISTRY_ABI = [
  "function getSnapshotCount(uint256 agentId) view returns (uint256)",
  "function getLatestSnapshot(uint256 agentId) view returns (tuple(string storageRoot, uint256 timestamp, uint256 memoryCount))",
  "function snapshots(uint256 agentId, uint256 index) view returns (string storageRoot, uint256 timestamp, uint256 memoryCount)",
] as const;

export const MARKETPLACE_ABI = [
  "function list(uint256 tokenId, uint256 price)",
  "function delist(uint256 tokenId)",
  "function buy(uint256 tokenId) payable",
  "function getListing(uint256 tokenId) view returns (address seller, uint256 price)",
  "function listedCount() view returns (uint256)",
  "function listedTokenIds(uint256 index) view returns (uint256)",
  "event Listed(uint256 indexed tokenId, address indexed seller, uint256 price)",
  "event Delisted(uint256 indexed tokenId, address indexed seller)",
  "event Sold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price)",
] as const;
