import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import * as fs from "fs";
import { resolveNetwork } from "../../../../lib/server-network";

const ABI = [
  "function getAgent(uint256) view returns (tuple(string name, string storageRoot, string kvStreamId, string encryptedConfig, uint256 createdAt, uint256 updatedAt))",
];

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const { sourceAgentId, targetAgentId, network: networkId } = await req.json();
    if (sourceAgentId === undefined || targetAgentId === undefined) {
      return NextResponse.json({ error: "sourceAgentId and targetAgentId required" }, { status: 400 });
    }

    const net = resolveNetwork(networkId);
    const inft = new ethers.Contract(net.inftAddress, ABI, net.provider);

    const [sourceAgent, targetAgent] = await Promise.all([inft.getAgent(sourceAgentId), inft.getAgent(targetAgentId)]);
    if (!sourceAgent.storageRoot) return NextResponse.json({ error: "Source agent has no stored memories" }, { status: 404 });

    const indexer = new Indexer(net.storageIndexer);
    const tmp = `/tmp/mindvault-share-${sourceAgentId}-${Date.now()}.json`;
    const err = await indexer.download(sourceAgent.storageRoot, tmp, true);
    if (err) return NextResponse.json({ error: `Storage download failed: ${err}` }, { status: 502 });

    const raw = fs.readFileSync(tmp, "utf-8");
    fs.unlinkSync(tmp);
    const memories = JSON.parse(raw);

    return NextResponse.json({
      memories, sourceAgent: { name: sourceAgent.name, storageRoot: sourceAgent.storageRoot },
      targetAgent: { name: targetAgent.name, tokenId: targetAgentId },
      memoryCount: Array.isArray(memories) ? memories.length : 0, latencyMs: Date.now() - start,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Share failed" }, { status: 500 });
  }
}
