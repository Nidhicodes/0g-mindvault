import { listServices, infer } from "./index.js";

async function main() {
  console.log("🧪 Testing 0G Compute integration...\n");

  // List available services
  const services = await listServices();
  console.log("Available services:");
  services.forEach((s, i) => console.log(`  ${i + 1}. ${s.model} (${s.type}) — ${s.provider.slice(0, 10)}...`));

  // Pick first chatbot service
  const chatbot = services.find((s) => s.type === "chatbot");
  if (!chatbot) {
    console.log("❌ No chatbot service available");
    return;
  }

  console.log(`\n🤖 Using: ${chatbot.model}`);

  // Run inference
  const result = await infer(chatbot.provider, [
    { role: "system", content: "You are a helpful AI agent with persistent memory." },
    { role: "user", content: "What is 0G and why is decentralized AI important?" },
  ]);

  console.log(`\n💬 Response: ${result.content.slice(0, 200)}...`);
  console.log(`🔐 TEE Verified: ${result.verified}`);
  console.log(`📋 Model: ${result.model}`);
}

main().catch(console.error);
