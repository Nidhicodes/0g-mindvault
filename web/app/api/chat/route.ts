import { NextResponse } from "next/server";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const PK = process.env.PRIVATE_KEY || "";

// Compute brokers per network — cached after first creation
const _brokers: Record<string, Awaited<ReturnType<typeof createZGComputeNetworkBroker>>> = {};

const COMPUTE_RPCS: Record<string, string> = {
  mainnet: "https://evmrpc.0g.ai",
  testnet: "https://evmrpc-testnet.0g.ai",
};

async function getBroker(network: string) {
  const rpc = COMPUTE_RPCS[network] || COMPUTE_RPCS.testnet;
  if (!_brokers[network]) {
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(PK, provider);
    _brokers[network] = await createZGComputeNetworkBroker(wallet);
  }
  return _brokers[network];
}

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const { messages, providerAddress, network: reqNetwork } = await req.json();

    // Try requested network first, fall back to testnet if mainnet compute isn't funded
    let network = reqNetwork || "testnet";
    let broker = await getBroker(network);
    let lastError = "";

    for (const tryNetwork of [network, ...(network !== "testnet" ? ["testnet"] : [])]) {
      try {
        broker = await getBroker(tryNetwork);
        let provider = providerAddress;
        if (!provider) {
          const services = await broker.inference.listService();
          const chatbot = services.find((s: { serviceType: string }) => s.serviceType === "chatbot");
          if (!chatbot) { lastError = "No chatbot service available"; continue; }
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
        const chatId = resp.headers.get("ZG-Res-Key") || data.id || "";

        let verified = false;
        if (chatId) {
          try { verified = !!(await broker.inference.processResponse(provider, chatId)); } catch { verified = false; }
        }

        return NextResponse.json({
          content, model, verified, chatId, provider,
          computeNetwork: tryNetwork,
          latencyMs: Date.now() - start,
        });
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : "Failed";
        if (lastError.includes("AccountNotExists") || lastError.includes("Sub-account not found") || lastError.includes("Account does not exist")) {
          continue; // Try next network
        }
        break; // Other error, don't retry
      }
    }

    if (lastError.includes("AccountNotExists") || lastError.includes("Sub-account not found") || lastError.includes("Account does not exist")) {
      return NextResponse.json({ error: "0G Compute account not funded. Run: npx tsx compute/setup.ts" }, { status: 402 });
    }
    return NextResponse.json({ error: lastError, latencyMs: Date.now() - start }, { status: 500 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Inference failed", latencyMs: Date.now() - start }, { status: 500 });
  }
}
