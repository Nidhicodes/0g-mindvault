import { uploadMemories, downloadMemories, type Memory } from "../storage/index.js";
import { infer } from "../compute/index.js";
import { ethers } from "ethers";
import "dotenv/config";

export interface Agent {
  tokenId: number;
  name: string;
  systemPrompt: string;
  memories: Memory[];
  providerAddress: string;
}

/// Build context from agent memories for injection into inference
function buildMemoryContext(memories: Memory[]): string {
  if (memories.length === 0) return "";
  const recent = memories.slice(-20); // last 20 memories
  const lines = recent.map((m) => `[${m.type}] ${m.content}`);
  return `\n\nYour persistent memories:\n${lines.join("\n")}`;
}

/// Run a conversation turn: inject memories → infer → extract new memories → persist
export async function chat(
  agent: Agent,
  userMessage: string
): Promise<{ reply: string; verified: boolean; newMemories: Memory[] }> {
  const memoryContext = buildMemoryContext(agent.memories);

  const messages = [
    {
      role: "system",
      content: `${agent.systemPrompt}${memoryContext}\n\nAfter responding, if you learned any new facts about the user or topic, output them on separate lines prefixed with [MEMORY]:`,
    },
    { role: "user", content: userMessage },
  ];

  const result = await infer(agent.providerAddress, messages);

  // Extract new memories from response
  const newMemories: Memory[] = [];
  const lines = result.content.split("\n");
  const replyLines: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("[MEMORY]:")) {
      newMemories.push({
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        agentId: agent.tokenId,
        content: line.replace("[MEMORY]:", "").trim(),
        type: "fact",
        timestamp: Date.now(),
      });
    } else {
      replyLines.push(line);
    }
  }

  // Add new memories to agent
  agent.memories.push(...newMemories);

  return {
    reply: replyLines.join("\n").trim(),
    verified: result.verified,
    newMemories,
  };
}

/// Persist all agent memories to 0G Storage and return the root hash
export async function persistMemories(agent: Agent): Promise<string> {
  const { rootHash } = await uploadMemories(agent.memories);
  console.log(`💾 Agent "${agent.name}" memories persisted — root: ${rootHash}`);
  return rootHash;
}

/// Restore agent memories from 0G Storage
export async function restoreMemories(rootHash: string): Promise<Memory[]> {
  const outputPath = `/tmp/mindvault-restore-${Date.now()}.json`;
  return downloadMemories(rootHash, outputPath);
}
