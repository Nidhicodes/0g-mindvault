import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import * as fs from "fs";
import { resolveNetwork } from "../../../../lib/server-network";

const ABI = [
  "function getAgent(uint256) view returns (string name, string storageRoot, string kvStreamId, string encryptedConfig, uint256 createdAt, uint256 updatedAt)",
];

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const { agentId, network: networkId } = await req.json();
    if (agentId === undefined) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const net = resolveNetwork(networkId);
    const inft = new ethers.Contract(net.inftAddress, ABI, net.provider);
    const agent = await inft.getAgent(agentId);

    if (!agent.storageRoot) {
      return NextResponse.json({ error: "No memories stored for this agent", memories: [], rootHash: "" });
    }

    const indexer = new Indexer(net.storageIndexer);
    const tmp = `/tmp/mindvault-restore-${agentId}-${Date.now()}.json`;
    const err = await indexer.download(agent.storageRoot, tmp, true);
    if (err) return NextResponse.json({ error: `Storage download failed: ${err}` }, { status: 502 });

    const raw = fs.readFileSync(tmp, "utf-8");
    fs.unlinkSync(tmp);
    const memories = JSON.parse(raw);

    return NextResponse.json({ memories, rootHash: agent.storageRoot, agentName: agent.name, memoryCount: Array.isArray(memories) ? memories.length : 0, latencyMs: Date.now() - start });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Restore failed" }, { status: 500 });
  }
}
