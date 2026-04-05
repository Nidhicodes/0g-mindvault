import { NextRequest, NextResponse } from "next/server";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!PRIVATE_KEY) {
      return NextResponse.json({ reply: "Server not configured — missing PRIVATE_KEY", verified: false });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    // Try 0G Compute first
    try {
      const broker = await createZGComputeNetworkBroker(wallet);

      // Ensure ledger exists
      try { await broker.ledger.getLedger(); } catch {
        await broker.ledger.addLedger(3);
      }

      const services = await broker.inference.listService();
      const chatbot = services.find((s: { serviceType: string }) => s.serviceType === "chatbot");
      if (!chatbot) throw new Error("No chatbot service");

      // Ensure provider funded
      const providers = await broker.ledger.getProvidersWithBalance("inference");
      const existing = providers.find(([addr]: [string, bigint, bigint]) => addr.toLowerCase() === chatbot.provider.toLowerCase());
      if (!existing || existing[1] === BigInt(0)) {
        await broker.ledger.transferFund(chatbot.provider, "inference", ethers.parseEther("1"));
      }

      const { endpoint, model } = await broker.inference.getServiceMetadata(chatbot.provider);
      const headers = await broker.inference.getRequestHeaders(chatbot.provider);

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ messages, model }),
      });

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content || "No response";
      const chatId = response.headers.get("ZG-Res-Key") || data.id;

      let verified = false;
      if (chatId) {
        try { verified = (await broker.inference.processResponse(chatbot.provider, chatId)) ?? false; } catch {}
      }

      return NextResponse.json({ reply, verified, model, source: "0g-compute" });
    } catch (computeErr) {
      // Fallback: echo-style response when 0G Compute isn't funded
      const lastMsg = messages[messages.length - 1]?.content || "";
      const reply = `[0G Compute unavailable — insufficient A0GI for ledger. Need 3+ A0GI, use faucet.0g.ai]\n\nYou said: "${lastMsg}"\n\nThis agent's memories are stored on 0G Storage and identity is on-chain as an ERC-7857 INFT. Once funded with 3+ A0GI, inference will run through 0G Compute with TEE verification.`;
      console.warn("0G Compute fallback:", computeErr instanceof Error ? computeErr.message : computeErr);
      return NextResponse.json({ reply, verified: false, source: "fallback" });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ reply: `Error: ${msg}`, verified: false }, { status: 500 });
  }
}
