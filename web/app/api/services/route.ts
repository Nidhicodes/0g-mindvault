import { NextResponse } from "next/server";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";

const RPC = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const PK = process.env.PRIVATE_KEY || "";

export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PK, provider);
    const broker = await createZGComputeNetworkBroker(wallet);
    const services = await broker.inference.listService();
    const mapped = services.map((s: { provider: string; model: string; serviceType: string; inputPrice: bigint; outputPrice: bigint }) => ({
      provider: s.provider, model: s.model, type: s.serviceType,
      inputPrice: String(s.inputPrice || 0), outputPrice: String(s.outputPrice || 0),
    }));
    return NextResponse.json({ services: mapped });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
