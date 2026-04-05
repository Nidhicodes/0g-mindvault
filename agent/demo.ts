/**
 * MindVault Agent Demo — end-to-end showcase
 *
 * Demonstrates the full loop:
 *   1. Mint an agent INFT on-chain
 *   2. Chat with the agent (0G Compute inference)
 *   3. Memories extracted and persisted to 0G Storage
 *   4. On-chain memory root updated
 *   5. Restore memories from storage to prove persistence
 */

import { chat, persistMemories, restoreMemories, type Agent } from "./index.js";
import { listServices } from "../compute/index.js";
import { uploadMemories, type Memory } from "../storage/index.js";
import { ethers } from "ethers";
import * as readline from "readline";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const INFT_ADDRESS = process.env.INFT_CONTRACT_ADDRESS!;
const REGISTRY_ADDRESS = process.env.MEMORY_REGISTRY_ADDRESS!;

const INFT_ABI = [
  "function mintAgent(string name, string encryptedConfig) returns (uint256)",
  "function getAgent(uint256) view returns (tuple(string name, string storageRoot, string kvStreamId, string encryptedConfig, uint256 createdAt, uint256 updatedAt))",
  "function updateMemory(uint256 tokenId, string storageRoot, string kvStreamId)",
  "function totalAgents() view returns (uint256)",
];

const REGISTRY_ABI = [
  "function setWriter(uint256 agentId, address writer)",
  "function recordSnapshot(uint256 agentId, string storageRoot, uint256 memoryCount)",
  "function getLatestSnapshot(uint256 agentId) view returns (tuple(string storageRoot, uint256 timestamp, uint256 memoryCount))",
];

function getSigner() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.Wallet(PRIVATE_KEY, provider);
}


async function mintAgentOnChain(name: string, systemPrompt: string): Promise<number> {
  const signer = getSigner();
  const inft = new ethers.Contract(INFT_ADDRESS, INFT_ABI, signer);

  console.log(`\n🔨 Minting agent "${name}" on-chain...`);
  const tx = await inft.mintAgent(name, systemPrompt);
  const receipt = await tx.wait();

  // Parse tokenId from AgentMinted event
  const iface = new ethers.Interface(["event AgentMinted(uint256 indexed tokenId, address indexed owner, string name)"]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "AgentMinted") {
        const tokenId = Number(parsed.args.tokenId);
        console.log(`✅ Agent minted — Token ID: ${tokenId}`);
        console.log(`🔗 https://chainscan-galileo.0g.ai/tx/${receipt.hash}`);
        return tokenId;
      }
    } catch { /* skip non-matching logs */ }
  }
  throw new Error("Failed to parse AgentMinted event");
}

async function updateOnChainMemory(tokenId: number, rootHash: string) {
  const signer = getSigner();
  const inft = new ethers.Contract(INFT_ADDRESS, INFT_ABI, signer);
  const tx = await inft.updateMemory(tokenId, rootHash, "");
  await tx.wait();
  console.log(`🔗 Memory root updated on-chain for agent #${tokenId}`);
}

async function recordSnapshot(tokenId: number, rootHash: string, count: number) {
  const signer = getSigner();
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
  try {
    const tx = await registry.recordSnapshot(tokenId, rootHash, count);
    await tx.wait();
    console.log(`📸 Snapshot recorded in MemoryRegistry`);
  } catch (e: any) {
    // Writer might not be set yet
    if (e.message?.includes("Not authorized")) {
      console.log(`⚠️  Setting writer for agent #${tokenId}...`);
      const setTx = await registry.setWriter(tokenId, await signer.getAddress());
      await setTx.wait();
      const tx = await registry.recordSnapshot(tokenId, rootHash, count);
      await tx.wait();
      console.log(`📸 Snapshot recorded in MemoryRegistry`);
    } else {
      console.log(`⚠️  Registry snapshot skipped: ${e.message}`);
    }
  }
}


async function findProvider(): Promise<string> {
  // Use env var if set
  if (process.env.COMPUTE_PROVIDER_ADDRESS) {
    console.log(`\n🤖 Using configured provider: ${process.env.COMPUTE_PROVIDER_ADDRESS.slice(0, 12)}...`);
    return process.env.COMPUTE_PROVIDER_ADDRESS;
  }

  console.log("\n🔍 Discovering 0G Compute services...");
  try {
    const services = await listServices();
    const chatbot = services.find((s) => s.type === "chatbot");
    if (chatbot) {
      console.log(`🤖 Using: ${chatbot.model} via ${chatbot.provider.slice(0, 12)}...`);
      return chatbot.provider;
    }
    console.log("⚠️  No chatbot services found, falling back to storage-only demo");
  } catch (e: unknown) {
    console.log(`⚠️  0G Compute discovery failed: ${e instanceof Error ? e.message : e}`);
    console.log("   Continuing with storage-only demo (mint + memory persistence)");
  }
  return "";
}

async function runInteractive(agent: Agent) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

  console.log(`\n💬 Chat with "${agent.name}" (type "quit" to save & exit)\n`);

  while (true) {
    const input = await ask("You: ");
    if (input.toLowerCase() === "quit" || input.toLowerCase() === "exit") break;
    if (!input.trim()) continue;

    try {
      const result = await chat(agent, input);
      console.log(`\nAgent: ${result.reply}`);
      console.log(`  🔐 TEE Verified: ${result.verified}`);
      if (result.newMemories.length > 0) {
        console.log(`  🧠 New memories: ${result.newMemories.map((m) => m.content).join("; ")}`);
      }
      console.log();
    } catch (e: any) {
      console.log(`❌ Inference error: ${e.message}\n`);
    }
  }

  rl.close();

  // Persist memories on exit
  if (agent.memories.length > 0) {
    console.log(`\n💾 Persisting ${agent.memories.length} memories to 0G Storage...`);
    const rootHash = await persistMemories(agent);
    await updateOnChainMemory(agent.tokenId, rootHash);
    await recordSnapshot(agent.tokenId, rootHash, agent.memories.length);
    console.log(`\n✅ All done! Agent memories are on-chain and verifiable.`);
  }
}

async function runDemo() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🧠 MindVault — Agent Memory & Identity Demo");
  console.log("═══════════════════════════════════════════════");

  const signer = getSigner();
  const balance = await signer.provider!.getBalance(signer.address);
  console.log(`\n👛 Wallet: ${signer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} 0G`);

  // Step 1: Mint agent
  const agentName = "MindVault Assistant";
  const systemPrompt = "You are MindVault Assistant, an AI with persistent memory on 0G. You remember everything users tell you across sessions. Be helpful, concise, and reference past memories when relevant.";
  const tokenId = await mintAgentOnChain(agentName, systemPrompt);

  // Step 2: Find compute provider
  const providerAddress = await findProvider();

  if (!providerAddress) {
    // Storage-only demo: persist sample memories to show the full on-chain flow
    console.log("\n📝 Running storage-only demo (no compute provider available)...");
    const memories: Memory[] = [
      { id: `mem_${Date.now()}_1`, agentId: tokenId, content: "User is building MindVault for the 0G hackathon", type: "fact", timestamp: Date.now() },
      { id: `mem_${Date.now()}_2`, agentId: tokenId, content: "User prefers concise, technical responses", type: "preference", timestamp: Date.now() },
      { id: `mem_${Date.now()}_3`, agentId: tokenId, content: "Discussed persistent memory architecture on 0G Storage", type: "conversation", timestamp: Date.now() },
    ];

    console.log(`\n💾 Persisting ${memories.length} memories to 0G Storage...`);
    const { rootHash } = await uploadMemories(memories);
    console.log(`📦 Root hash: ${rootHash}`);

    await updateOnChainMemory(tokenId, rootHash);
    await recordSnapshot(tokenId, rootHash, memories.length);

    console.log(`\n🔄 Restoring memories from 0G Storage to verify...`);
    const restored = await restoreMemories(rootHash);
    console.log(`✅ Restored ${restored.length} memories`);
    restored.forEach((m) => console.log(`  📝 [${m.type}] ${m.content}`));

    console.log(`\n🎉 Agent #${tokenId} minted + memories persisted on-chain!`);
    console.log(`🔗 INFT: https://chainscan-galileo.0g.ai/address/${INFT_ADDRESS}`);
    return;
  }

  // Step 3: Create agent instance
  const agent: Agent = {
    tokenId,
    name: agentName,
    systemPrompt,
    memories: [],
    providerAddress,
  };

  // Step 4: Interactive chat
  await runInteractive(agent);
}

// Non-interactive demo for video recording / CI
async function runScriptedDemo() {
  console.log("═══════════════════════════════════════════════");
  console.log("  🧠 MindVault — Scripted Demo (for recording)");
  console.log("═══════════════════════════════════════════════");

  const signer = getSigner();
  const balance = await signer.provider!.getBalance(signer.address);
  console.log(`\n👛 Wallet: ${signer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} 0G`);

  // Mint
  const tokenId = await mintAgentOnChain("MindVault Demo Agent", "You are a helpful AI with persistent memory. Remember facts about the user. After responding, output new facts as [MEMORY]: lines.");

  // Find provider
  const providerAddress = await findProvider();

  if (!providerAddress) {
    // Storage-only scripted demo
    console.log("\n📝 Running storage-only scripted demo...");
    const memories: Memory[] = [
      { id: `mem_${Date.now()}_1`, agentId: tokenId, content: "User's name is Alex", type: "fact", timestamp: Date.now() },
      { id: `mem_${Date.now()}_2`, agentId: tokenId, content: "Alex is building MindVault for the 0G APAC Hackathon", type: "fact", timestamp: Date.now() },
      { id: `mem_${Date.now()}_3`, agentId: tokenId, content: "MindVault gives AI agents persistent memory using 0G Storage", type: "conversation", timestamp: Date.now() },
    ];

    console.log(`\n💾 Persisting ${memories.length} memories to 0G Storage...`);
    const { rootHash } = await uploadMemories(memories);
    await updateOnChainMemory(tokenId, rootHash);
    await recordSnapshot(tokenId, rootHash, memories.length);

    console.log(`\n🔄 Restoring memories from 0G Storage to verify...`);
    const restored = await restoreMemories(rootHash);
    console.log(`✅ Restored ${restored.length} memories from root: ${rootHash.slice(0, 20)}...`);
    restored.forEach((m) => console.log(`  📝 [${m.type}] ${m.content}`));

    console.log(`\n🎉 Demo complete! Agent #${tokenId} has persistent, verifiable memory on 0G.`);
    return;
  }

  const agent: Agent = {
    tokenId,
    name: "MindVault Demo Agent",
    systemPrompt: "You are a helpful AI with persistent memory. Remember facts about the user. After responding, output new facts as [MEMORY]: lines.",
    memories: [],
    providerAddress,
  };

  // Scripted conversation
  const prompts = [
    "Hi! My name is Alex and I'm building a project for the 0G hackathon.",
    "I'm working on MindVault — it gives AI agents persistent memory using 0G Storage.",
    "What do you remember about me so far?",
  ];

  for (const prompt of prompts) {
    console.log(`\nYou: ${prompt}`);
    const result = await chat(agent, prompt);
    console.log(`Agent: ${result.reply}`);
    console.log(`  🔐 TEE Verified: ${result.verified}`);
    if (result.newMemories.length > 0) {
      console.log(`  🧠 Memories: ${result.newMemories.map((m) => m.content).join("; ")}`);
    }
  }

  // Persist
  console.log(`\n💾 Persisting ${agent.memories.length} memories to 0G Storage...`);
  const rootHash = await persistMemories(agent);
  await updateOnChainMemory(agent.tokenId, rootHash);
  await recordSnapshot(agent.tokenId, rootHash, agent.memories.length);

  // Restore to prove persistence
  console.log(`\n🔄 Restoring memories from 0G Storage to verify...`);
  const restored = await restoreMemories(rootHash);
  console.log(`✅ Restored ${restored.length} memories from root: ${rootHash.slice(0, 20)}...`);
  restored.forEach((m) => console.log(`  📝 [${m.type}] ${m.content}`));

  console.log(`\n🎉 Demo complete! Agent #${tokenId} has persistent, verifiable memory on 0G.`);
}

// Entry point
const mode = process.argv[2];
if (mode === "--scripted") {
  runScriptedDemo().catch(console.error);
} else {
  runDemo().catch(console.error);
}
