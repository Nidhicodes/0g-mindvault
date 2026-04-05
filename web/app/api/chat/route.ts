import { NextResponse } from "next/server";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const RPC = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const PK = process.env.PRIVATE_KEY || "";

let _broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;

async function getBroker() {
  if (!_broker) {
    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PK, provider);
    _broker = await createZGComputeNetworkBroker(wallet);
  }
  return _broker;
}

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const { messages, providerAddress } = await req.json();
    const broker = await getBroker();

    let provider = providerAddress;
    if (!provider) {
      const services = await broker.inference.listService();
      const chatbot = services.find((s: { serviceType: string }) => s.serviceType === "chatbot");
      if (!chatbot) return NextResponse.json({ error: "No chatbot service available on 0G Compute. Check provider status." }, { status: 503 });
      provider = chatbot.provider;
    }

    const { endpoint, model } = await broker.inference.getServiceMetadata(provider);
    const headers = await broker.inference.getRequestHeaders(provider);

    const resp = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ messages, model }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "unknown");
      return NextResponse.json({ error: `Inference failed (HTTP ${resp.status}): ${errText}` }, { status: 502 });
    }

    const data = await resp.json();
    if (!data.choices?.[0]?.message?.content) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }

    const content = data.choices[0].message.content;
    // TEE verification key: prefer ZG-Res-Key header, fall back to response id
    const chatId = resp.headers.get("ZG-Res-Key") || data.id || "";

    let verified = false;
    if (chatId) {
      try { verified = !!(await broker.inference.processResponse(provider, chatId)); } catch { verified = false; }
    }

    return NextResponse.json({
      content, model, verified, chatId, provider,
      latencyMs: Date.now() - start,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Inference failed";
    // Provide actionable error messages
    if (msg.includes("AccountNotExists") || msg.includes("Sub-account not found")) {
      return NextResponse.json({ error: "0G Compute account not funded. Run: npx tsx compute/setup.ts" }, { status: 402 });
    }
    return NextResponse.json({ error: msg, latencyMs: Date.now() - start }, { status: 500 });
  }
}
