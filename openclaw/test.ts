/**
 * Test the MindVault OpenClaw plugin tools end-to-end.
 * Demonstrates: store memory → on-chain update → recall memory
 */
import { tools, generateOpenClawConfig } from "./plugin.js";
import "dotenv/config";

async function main() {
  console.log("=== MindVault OpenClaw Plugin Test ===\n");

  // 1. Show generated OpenClaw config
  const config = generateOpenClawConfig();
  console.log("📋 OpenClaw Config:");
  console.log(JSON.stringify(config, null, 2));

  // 2. Get agent identity
  console.log("\n🔍 Getting agent #0 identity...");
  const agentResult = await tools.mindvault_get_agent.execute({ agentId: 0 });
  console.log(agentResult.content);

  if (agentResult.isError) {
    console.log("⚠️  No agents minted yet — mint one via the frontend first");
    return;
  }

  // 3. Store memories
  console.log("\n💾 Storing memories to 0G Storage...");
  const memories = [
    { id: "test-1", content: "User prefers concise responses", type: "preference", timestamp: Date.now() },
    { id: "test-2", content: "Discussed 0G hackathon strategy", type: "conversation", timestamp: Date.now() },
  ];
  const storeResult = await tools.mindvault_store_memory.execute({ agentId: 0, memories });
  console.log(storeResult.content);

  if (storeResult.isError) {
    console.log("⚠️  Storage failed (likely insufficient gas). Memory recall will use existing root.");
  }

  // 4. Recall memories
  console.log("\n🧠 Recalling memories from 0G Storage...");
  const recallResult = await tools.mindvault_recall_memory.execute({ agentId: 0 });
  console.log(recallResult.content);

  console.log("\n✅ OpenClaw plugin test complete");
}

main().catch(console.error);
