import { uploadMemories, downloadMemories, type Memory } from "../storage/index.js";
import { infer } from "../compute/index.js";
import "dotenv/config";

export interface Agent {
  tokenId: number;
  name: string;
  systemPrompt: string;
  memories: Memory[];
  providerAddress: string;
}

export interface ChatResult {
  reply: string;
  verified: boolean;
  newMemories: Memory[];
  model: string;
  latencyMs: number;
}

/**
 * Semantic relevance scoring — picks the most relevant memories for the current message.
 * Uses TF-IDF-like keyword overlap: tokenizes both the query and each memory,
 * scores by overlap ratio weighted by inverse frequency.
 */
function scoreRelevance(memory: string, query: string): number {
  const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);
  const queryTokens = new Set(tokenize(query));
  const memTokens = tokenize(memory);
  if (queryTokens.size === 0 || memTokens.length === 0) return 0;
  let hits = 0;
  for (const t of memTokens) { if (queryTokens.has(t)) hits++; }
  return hits / Math.max(memTokens.length, 1);
}

function selectRelevantMemories(memories: Memory[], query: string, maxCount = 20): Memory[] {
  if (memories.length <= maxCount) return memories;

  // Score each memory for relevance to the current query
  const scored = memories.map(m => ({ m, score: scoreRelevance(m.content, query) }));

  // Always include recent memories (last 5) regardless of relevance
  const recent = new Set(memories.slice(-5).map(m => m.id));

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  const selected: Memory[] = [];
  const seen = new Set<string>();

  // Add top scored
  for (const { m } of scored) {
    if (selected.length >= maxCount) break;
    if (!seen.has(m.id)) { selected.push(m); seen.add(m.id); }
  }

  // Ensure recent memories are included
  for (const m of memories.slice(-5)) {
    if (!seen.has(m.id) && selected.length < maxCount + 5) {
      selected.push(m); seen.add(m.id);
    }
  }

  return selected;
}

function buildMemoryContext(memories: Memory[], query: string): string {
  if (memories.length === 0) return "";
  const relevant = selectRelevantMemories(memories, query);
  const byType: Record<string, Memory[]> = {};
  for (const m of relevant) (byType[m.type] ||= []).push(m);
  const lines = [`\n\nYour persistent memories (${relevant.length}/${memories.length} most relevant):`];
  for (const [type, mems] of Object.entries(byType)) {
    lines.push(`[${type}]`);
    for (const m of mems) lines.push(`  - ${m.content}`);
  }
  return lines.join("\n");
}

/**
 * Memory conflict resolution — when a new memory contradicts an existing one,
 * mark the old one as superseded. Detects contradictions by checking if both
 * memories are about the same subject but with different values.
 */
function resolveConflicts(existing: Memory[], newMemories: Memory[]): { kept: Memory[]; superseded: string[] } {
  const superseded: string[] = [];

  // Simple subject extraction: first few significant words
  const getSubject = (content: string): string => {
    const words = content.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2);
    // Look for patterns like "user lives in X", "user's name is X", "user prefers X"
    const subjectWords = words.slice(0, 4).join(" ");
    return subjectWords;
  };

  // Check for contradictions between fact-type memories
  for (const newMem of newMemories) {
    if (newMem.type !== "fact" && newMem.type !== "preference") continue;
    const newSubject = getSubject(newMem.content);
    if (newSubject.length < 6) continue;

    for (const old of existing) {
      if (old.type !== newMem.type) continue;
      const oldSubject = getSubject(old.content);

      // If subjects overlap significantly but content differs, it's a contradiction
      const newWords = new Set(newSubject.split(" "));
      const oldWords = oldSubject.split(" ");
      const overlap = oldWords.filter(w => newWords.has(w)).length;
      const overlapRatio = overlap / Math.max(oldWords.length, 1);

      if (overlapRatio > 0.5 && old.content.toLowerCase() !== newMem.content.toLowerCase()) {
        superseded.push(old.id);
      }
    }
  }

  const supersededSet = new Set(superseded);
  const kept = existing.filter(m => !supersededSet.has(m.id));
  return { kept, superseded };
}

/**
 * Two-pass memory extraction:
 * Pass 1: Normal chat response (clean, no [MEMORY] tags in output)
 * Pass 2: Separate extraction call that returns structured JSON memories
 * Falls back to single-pass [MEMORY]: parsing if pass 2 fails
 */
function extractMemoriesSinglePass(text: string, agentId: number): Memory[] {
  const memories: Memory[] = [];
  const now = Date.now();
  const parts = text.split(/\[MEMORY\]:\s*/);
  for (let i = 1; i < parts.length; i++) {
    const content = parts[i].split("\n")[0].trim();
    if (content && content.length > 3 && content.length < 500) {
      let type: Memory["type"] = "fact";
      const l = content.toLowerCase();
      if (l.includes("prefer") || l.includes("likes") || l.includes("wants")) type = "preference";
      else if (l.includes("discussed") || l.includes("talked")) type = "conversation";
      else if (l.includes("can ") || l.includes("knows how")) type = "skill";
      memories.push({ id: `mem_${now}_${Math.random().toString(36).slice(2, 8)}`, agentId, content, type, timestamp: now });
    }
  }
  return memories;
}

async function extractMemoriesTwoPass(
  reply: string,
  userMessage: string,
  providerAddress: string,
  agentId: number,
  existingMemories: Memory[]
): Promise<Memory[]> {
  const existingFacts = existingMemories.map(m => m.content).join("; ");
  const extractionPrompt = [
    {
      role: "system",
      content: `You are a memory extraction system. Given a conversation exchange, extract NEW facts learned. Output ONLY a JSON array of objects with "content" (string) and "type" (one of: "fact", "preference", "conversation", "skill"). Output [] if nothing new was learned. Do NOT include facts already known. Already known: ${existingFacts || "nothing yet"}`,
    },
    {
      role: "user",
      content: `User said: "${userMessage}"\nAssistant replied: "${reply.slice(0, 500)}"\n\nExtract new memories as JSON array:`,
    },
  ];

  try {
    const result = await infer(providerAddress, extractionPrompt);
    // Parse JSON from response — handle markdown code blocks
    let jsonStr = result.content.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/) || jsonStr.match(/(\[[\s\S]*\])/);
    if (match) jsonStr = match[1].trim();

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    return parsed
      .filter((m: { content?: string; type?: string }) => m.content && m.content.length > 3 && m.content.length < 500)
      .map((m: { content: string; type?: string }) => ({
        id: `mem_${now}_${Math.random().toString(36).slice(2, 8)}`,
        agentId,
        content: m.content,
        type: (["fact", "preference", "conversation", "skill"].includes(m.type || "") ? m.type : "fact") as Memory["type"],
        timestamp: now,
      }));
  } catch {
    return []; // Two-pass failed, caller will use single-pass fallback
  }
}

export async function chat(agent: Agent, userMessage: string): Promise<ChatResult> {
  const memoryContext = buildMemoryContext(agent.memories, userMessage);

  const chatMessages = [
    {
      role: "system",
      content: `${agent.systemPrompt}${memoryContext}\n\nAfter responding, if you learned any new facts, output them on separate lines prefixed with [MEMORY]:`,
    },
    { role: "user", content: userMessage },
  ];

  const result = await infer(agent.providerAddress, chatMessages);

  const singlePassMems = extractMemoriesSinglePass(result.content, agent.tokenId);
  const replyText = result.content.split(/\[MEMORY\]:\s*/)[0].trim();

  let newMemories = singlePassMems;
  if (singlePassMems.length === 0 && agent.providerAddress) {
    const twoPassMems = await extractMemoriesTwoPass(replyText, userMessage, agent.providerAddress, agent.tokenId, agent.memories);
    if (twoPassMems.length > 0) newMemories = twoPassMems;
  }

  // Deduplicate
  const existingSet = new Set(agent.memories.map(m => m.content.toLowerCase().trim()));
  const unique = newMemories.filter(m => !existingSet.has(m.content.toLowerCase().trim()));

  // Resolve conflicts — supersede old memories that contradict new ones
  if (unique.length > 0) {
    const { kept, superseded } = resolveConflicts(agent.memories, unique);
    if (superseded.length > 0) {
      agent.memories = kept;
      console.log(`[Memory] Superseded ${superseded.length} conflicting memories`);
    }
  }

  agent.memories.push(...unique);

  return { reply: replyText, verified: result.verified, newMemories: unique, model: result.model, latencyMs: result.latencyMs };
}

export async function persistMemories(agent: Agent): Promise<string> {
  if (agent.memories.length === 0) throw new Error("No memories to persist");
  const { rootHash } = await uploadMemories(agent.memories);
  return rootHash;
}

export async function restoreMemories(rootHash: string): Promise<Memory[]> {
  return downloadMemories(rootHash, `/tmp/mindvault-restore-${Date.now()}.json`);
}
