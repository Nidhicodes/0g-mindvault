import { uploadMemories, downloadMemories, type Memory } from "./index.js";

async function main() {
  console.log("🧪 Testing 0G Storage integration...\n");

  const testMemories: Memory[] = [
    {
      id: "mem_001",
      agentId: 0,
      content: "User prefers concise responses with code examples",
      type: "preference",
      timestamp: Date.now(),
    },
    {
      id: "mem_002",
      agentId: 0,
      content: "Discussed 0G hackathon strategy on April 2, 2026",
      type: "conversation",
      timestamp: Date.now(),
    },
  ];

  // Upload
  const { rootHash } = await uploadMemories(testMemories);
  console.log(`\n📦 Root hash: ${rootHash}`);

  // Download & verify
  const downloaded = await downloadMemories(rootHash, "/tmp/mindvault-test.json");
  console.log(`\n📥 Downloaded ${downloaded.length} memories`);
  console.log(`✅ Round-trip test passed: ${downloaded[0].content}`);
}

main().catch(console.error);
