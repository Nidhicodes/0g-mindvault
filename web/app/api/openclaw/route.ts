import { NextResponse } from "next/server";

const INFT = process.env.INFT_CONTRACT_ADDRESS || "0xcfee7588d1C396fa76d1D7f6f2BBC50153775785";
const REG = process.env.MEMORY_REGISTRY_ADDRESS || "0xd0565f93f450494e8373dE7f33d565E0B5b41089";
const RPC = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const IDX = process.env.STORAGE_INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai";

export async function GET() {
  const config = {
    providers: {
      "0g-compute": {
        baseUrl: "https://0g-compute-provider/v1/proxy",
        apiKey: "on-chain-billing",
        api: "openai-completions",
        models: [
          { id: "qwen/qwen-2.5-7b-instruct", name: "Qwen 2.5 7B (0G TEE Verified)" },
          { id: "deepseek-chat-v3", name: "DeepSeek V3 (0G TEE Verified)" },
        ],
        cost: 0,
      },
    },
    agents: {
      defaults: { models: ["0g-compute/qwen-2.5-7b-instruct"] },
      list: [{
        id: "mindvault-agent",
        name: "MindVault Agent",
        tools: { allow: ["mindvault_store_memory", "mindvault_recall_memory", "mindvault_get_agent"] },
      }],
    },
    plugins: {
      mindvault: {
        enabled: true,
        contracts: { inft: INFT, registry: REG },
        storage: { indexerRpc: IDX },
        chain: { rpcUrl: RPC, chainId: 16602 },
      },
    },
  };

  const tools = [
    {
      name: "mindvault_store_memory",
      description: "Store agent memories to 0G decentralized storage and record on-chain snapshot",
      parameters: { agentId: "number — INFT token ID", memories: "array — memory objects to persist" },
      flow: "memories → 0G Storage (Merkle proof) → INFT.updateMemory() → Registry.recordSnapshot()",
    },
    {
      name: "mindvault_recall_memory",
      description: "Retrieve agent memories from 0G storage using on-chain root hash",
      parameters: { agentId: "number — INFT token ID" },
      flow: "INFT.getAgent() → storageRoot → 0G Storage download → parse JSON memories",
    },
    {
      name: "mindvault_get_agent",
      description: "Get agent identity and metadata from on-chain INFT",
      parameters: { agentId: "number — INFT token ID" },
      flow: "INFT.getAgent() → { name, storageRoot, createdAt, updatedAt }",
    },
  ];

  const hooks = [
    { event: "agent_end", action: "Memory checkpoint — auto-save conversation context when session ends" },
  ];

  return NextResponse.json({ config, tools, hooks });
}
