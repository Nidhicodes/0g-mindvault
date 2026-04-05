/**
 * MindVault OpenClaw Plugin
 *
 * Exposes 0G Storage (memory persistence) and 0G Chain (agent identity)
 * as OpenClaw tools/skills. When loaded into an OpenClaw gateway, agents
 * gain persistent memory backed by decentralized storage and on-chain
 * identity via ERC-7857 INFTs.
 *
 * Compatible with OpenClaw plugin-sdk contract (hooks + tools).
 */

import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import * as fs from "fs";

// --- Types matching OpenClaw plugin contract ---

interface PluginContext {
  config: Record<string, unknown>;
  agentId?: string;
  sessionKey?: string;
}

interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

interface ToolResult {
  content: string;
  isError?: boolean;
}

interface PluginHooks {
  after_tool_call?: (ctx: PluginContext, call: ToolCall, result: ToolResult) => Promise<void>;
  agent_end?: (ctx: PluginContext) => Promise<void>;
}

// --- 0G Configuration ---

const RPC_URL = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_RPC = process.env.STORAGE_INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const INFT_ADDRESS = process.env.INFT_CONTRACT_ADDRESS || "";
const REGISTRY_ADDRESS = process.env.MEMORY_REGISTRY_ADDRESS || "";

// Minimal ABI fragments
const INFT_ABI = [
  "function getAgent(uint256) view returns (string name, string storageRoot, string kvStreamId, string encryptedConfig, uint256 createdAt, uint256 updatedAt)",
  "function updateMemory(uint256 tokenId, string storageRoot, string kvStreamId)",
  "function totalAgents() view returns (uint256)",
];

const REGISTRY_ABI = [
  "function recordSnapshot(uint256 agentId, string storageRoot, uint256 memoryCount)",
  "function getLatestSnapshot(uint256 agentId) view returns (tuple(string storageRoot, uint256 timestamp, uint256 memoryCount))",
];

// --- Core Functions ---

function getSigner() {
  return new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider(RPC_URL));
}

async function uploadToStorage(data: unknown[]): Promise<{ rootHash: string; txHash: string }> {
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const memData = new MemData(encoded);
  const [, treeErr] = await memData.merkleTree();
  if (treeErr) throw new Error(`Merkle: ${treeErr}`);

  const indexer = new Indexer(INDEXER_RPC);
  const [tx, err] = await indexer.upload(memData, RPC_URL, getSigner());
  if (err) throw new Error(`Upload: ${err}`);
  return tx as { rootHash: string; txHash: string };
}

async function downloadFromStorage(rootHash: string): Promise<unknown[]> {
  const indexer = new Indexer(INDEXER_RPC);
  const tmp = `/tmp/mindvault-${rootHash.slice(0, 16)}.json`;
  const err = await indexer.download(rootHash, tmp, true);
  if (err) throw new Error(`Download: ${err}`);
  const raw = fs.readFileSync(tmp, "utf-8");
  fs.unlinkSync(tmp);
  return JSON.parse(raw);
}

// --- OpenClaw Tools ---

export const tools = {
  mindvault_store_memory: {
    description: "Store agent memories to 0G decentralized storage and record on-chain snapshot",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "number", description: "On-chain INFT token ID" },
        memories: { type: "array", description: "Array of memory objects to store" },
      },
      required: ["agentId", "memories"],
    },
    execute: async (input: { agentId: number; memories: unknown[] }): Promise<ToolResult> => {
      try {
        const { rootHash, txHash } = await uploadToStorage(input.memories);

        // Update on-chain pointers
        const signer = getSigner();
        const inft = new ethers.Contract(INFT_ADDRESS, INFT_ABI, signer);
        await inft.updateMemory(input.agentId, rootHash, "");

        const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
        await registry.recordSnapshot(input.agentId, rootHash, input.memories.length);

        return { content: JSON.stringify({ rootHash, txHash, count: input.memories.length }) };
      } catch (e) {
        return { content: `Error: ${e instanceof Error ? e.message : e}`, isError: true };
      }
    },
  },

  mindvault_recall_memory: {
    description: "Retrieve agent memories from 0G storage using on-chain root hash",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "number", description: "On-chain INFT token ID" },
      },
      required: ["agentId"],
    },
    execute: async (input: { agentId: number }): Promise<ToolResult> => {
      try {
        const signer = getSigner();
        const inft = new ethers.Contract(INFT_ADDRESS, INFT_ABI, signer);
        const agent = await inft.getAgent(input.agentId);
        if (!agent.storageRoot) return { content: "No memories stored yet" };

        const memories = await downloadFromStorage(agent.storageRoot);
        return { content: JSON.stringify({ storageRoot: agent.storageRoot, memories }) };
      } catch (e) {
        return { content: `Error: ${e instanceof Error ? e.message : e}`, isError: true };
      }
    },
  },

  mindvault_get_agent: {
    description: "Get agent identity and metadata from on-chain INFT",
    parameters: {
      type: "object",
      properties: { agentId: { type: "number" } },
      required: ["agentId"],
    },
    execute: async (input: { agentId: number }): Promise<ToolResult> => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const inft = new ethers.Contract(INFT_ADDRESS, INFT_ABI, provider);
        const agent = await inft.getAgent(input.agentId);
        return {
          content: JSON.stringify({
            name: agent.name,
            storageRoot: agent.storageRoot,
            createdAt: Number(agent.createdAt),
            updatedAt: Number(agent.updatedAt),
          }),
        };
      } catch (e) {
        return { content: `Error: ${e instanceof Error ? e.message : e}`, isError: true };
      }
    },
  },
};

// --- In-memory session buffer for auto-persist ---

const sessionMemories: Map<string, unknown[]> = new Map();

export function bufferMemory(sessionKey: string, memory: unknown) {
  const existing = sessionMemories.get(sessionKey) || [];
  existing.push(memory);
  sessionMemories.set(sessionKey, existing);
}

export function getSessionMemories(sessionKey: string): unknown[] {
  return sessionMemories.get(sessionKey) || [];
}

// --- OpenClaw Plugin Hooks ---

export const hooks: PluginHooks = {
  after_tool_call: async (ctx, call, result) => {
    // Buffer memories from tool calls during the session
    if (call.name === "mindvault_store_memory" && !result.isError && ctx.sessionKey) {
      const input = call.input as { memories?: unknown[] };
      if (input.memories) {
        for (const m of input.memories) bufferMemory(ctx.sessionKey, m);
      }
    }
  },

  agent_end: async (ctx) => {
    const key = ctx.sessionKey || "default";
    const memories = getSessionMemories(key);

    if (memories.length === 0) {
      console.log(`[MindVault] Session ${key} ended — no new memories to persist`);
      return;
    }

    // Auto-persist buffered memories to 0G Storage
    const agentId = ctx.agentId ? parseInt(ctx.agentId, 10) : 0;
    console.log(`[MindVault] Session ${key} ended — auto-persisting ${memories.length} memories for agent #${agentId}`);

    try {
      const { rootHash } = await uploadToStorage(memories);

      // Update on-chain pointers
      const signer = getSigner();
      const inft = new ethers.Contract(INFT_ADDRESS, INFT_ABI, signer);
      await (await inft.updateMemory(agentId, rootHash, "")).wait();

      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      try {
        await (await registry.recordSnapshot(agentId, rootHash, memories.length)).wait();
      } catch {
        // Writer may not be set — non-critical
      }

      console.log(`[MindVault] Auto-persisted ${memories.length} memories — root: ${rootHash}`);
    } catch (e) {
      console.error(`[MindVault] Auto-persist failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      sessionMemories.delete(key);
    }
  },
};

// --- OpenClaw Provider Config Generator ---

export function generateOpenClawConfig(providerEndpoint?: string) {
  return {
    providers: {
      "0g-compute": {
        baseUrl: providerEndpoint || "https://0g-compute-provider.example/v1/proxy",
        apiKey: "on-chain-billing",
        api: "openai-completions",
        models: [
          { id: "qwen-2.5-7b-instruct", name: "Qwen 2.5 7B (0G TEE)" },
          { id: "deepseek-chat-v3", name: "DeepSeek V3 (0G TEE)" },
        ],
        cost: 0, // billing is on-chain via 0G Compute ledger
      },
    },
    agents: {
      defaults: {
        models: ["0g-compute/qwen-2.5-7b-instruct"],
      },
    },
    plugins: {
      mindvault: {
        enabled: true,
        contracts: { inft: INFT_ADDRESS, registry: REGISTRY_ADDRESS },
        storage: { indexerRpc: INDEXER_RPC },
        chain: { rpcUrl: RPC_URL },
      },
    },
  };
}

// --- Export for direct use ---

export default { tools, hooks, generateOpenClawConfig };
