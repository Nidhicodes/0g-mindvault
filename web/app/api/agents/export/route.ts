import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import * as fs from "fs";
import { resolveNetwork } from "../../../../lib/server-network";

const INFT_ABI = [
  "function getAgent(uint256) view returns (tuple(string name, string storageRoot, string kvStreamId, string encryptedConfig, uint256 createdAt, uint256 updatedAt))",
  "function ownerOf(uint256 tokenId) view returns (address)",
];
const REG_ABI = [
  "function getSnapshotCount(uint256 agentId) view returns (uint256)",
  "function snapshots(uint256 agentId, uint256 index) view returns (string storageRoot, uint256 timestamp, uint256 memoryCount)",
];

export async function POST(req: Request) {
  try {
    const { tokenId, network: networkId } = await req.json();
    const net = resolveNetwork(networkId);
    const inft = new ethers.Contract(net.inftAddress, INFT_ABI, net.provider);
    const registry = new ethers.Contract(net.registryAddress, REG_ABI, net.provider);

    const [agent, owner] = await Promise.all([inft.getAgent(tokenId), inft.ownerOf(tokenId)]);

    let snapshots: { storageRoot: string; timestamp: number; memoryCount: number }[] = [];
    try {
      const cnt = Number(await registry.getSnapshotCount(tokenId));
      const snapPromises = Array.from({ length: cnt }, (_, j) => registry.snapshots(tokenId, j));
      const results = await Promise.all(snapPromises);
      snapshots = results.map(s => ({ storageRoot: s.storageRoot, timestamp: Number(s.timestamp), memoryCount: Number(s.memoryCount) }));
    } catch { /* no snapshots */ }

    let memories: unknown[] = [];
    if (agent.storageRoot) {
      try {
        const indexer = new Indexer(net.storageIndexer);
        const tmp = `/tmp/mindvault-export-${tokenId}-${Date.now()}.json`;
        const err = await indexer.download(agent.storageRoot, tmp, true);
        if (!err) { memories = JSON.parse(fs.readFileSync(tmp, "utf-8")); fs.unlinkSync(tmp); }
      } catch { /* memories unavailable */ }
    }

    return NextResponse.json({
      version: "1.0", exportedAt: new Date().toISOString(), platform: "MindVault on 0G",
      agent: { tokenId, name: agent.name, owner, encryptedConfig: agent.encryptedConfig, storageRoot: agent.storageRoot, createdAt: Number(agent.createdAt), updatedAt: Number(agent.updatedAt) },
      snapshots, memories,
      contracts: { inft: net.inftAddress, registry: net.registryAddress },
      chain: { rpc: net.rpcUrl, chainId: net.chainId, network: net.id },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Export failed" }, { status: 500 });
  }
}
