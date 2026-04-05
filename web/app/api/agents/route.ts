import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { encryptConfig, decryptConfig } from "../../../lib/encrypt";
import { resolveNetwork, getNetworkFromRequest } from "../../../lib/server-network";

const PK = process.env.PRIVATE_KEY || "";

const INFT_ABI = [
  "function mintAgent(string name, string encryptedConfig) returns (uint256)",
  "function getAgent(uint256) view returns (tuple(string name, string storageRoot, string kvStreamId, string encryptedConfig, uint256 createdAt, uint256 updatedAt))",
  "function totalAgents() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "event AgentMinted(uint256 indexed tokenId, address indexed owner, string name)",
];

const REG_ABI = [
  "function getSnapshotCount(uint256 agentId) view returns (uint256)",
  "function getLatestSnapshot(uint256 agentId) view returns (tuple(string storageRoot, uint256 timestamp, uint256 memoryCount))",
  "function snapshots(uint256 agentId, uint256 index) view returns (string storageRoot, uint256 timestamp, uint256 memoryCount)",
];

function tryDecrypt(encrypted: string, agentId: number): string {
  if (!encrypted || !PK) return encrypted;
  try { return decryptConfig(encrypted, PK, agentId); } catch { return encrypted; }
}

export async function GET(req: Request) {
  try {
    const net = resolveNetwork(getNetworkFromRequest(req.url));
    const inft = new ethers.Contract(net.inftAddress, INFT_ABI, net.provider);
    const registry = new ethers.Contract(net.registryAddress, REG_ABI, net.provider);
    const total = Number(await inft.totalAgents());

    const agentPromises = Array.from({ length: total }, (_, i) => (async () => {
      try {
        const [d, owner] = await Promise.all([inft.getAgent(i), inft.ownerOf(i)]);
        let snaps: { storageRoot: string; timestamp: number; memoryCount: number }[] = [];
        try {
          const cnt = Number(await registry.getSnapshotCount(i));
          if (cnt > 0) {
            const snapPromises = Array.from({ length: cnt }, (_, j) => registry.snapshots(i, j));
            const snapResults = await Promise.all(snapPromises);
            snaps = snapResults.map(s => ({ storageRoot: s.storageRoot, timestamp: Number(s.timestamp), memoryCount: Number(s.memoryCount) }));
          }
        } catch { /* no snapshots */ }
        return {
          tokenId: i, name: d.name, storageRoot: d.storageRoot, kvStreamId: d.kvStreamId,
          encryptedConfig: d.encryptedConfig, decryptedConfig: tryDecrypt(d.encryptedConfig, i),
          createdAt: Number(d.createdAt), updatedAt: Number(d.updatedAt), owner, snapshots: snaps,
        };
      } catch { return null; }
    })());

    const results = await Promise.all(agentPromises);
    const agents = results.filter(Boolean);
    const balance = ethers.formatEther(await net.provider.getBalance(net.signer.address));

    return NextResponse.json({ agents, total, balance, wallet: net.signer.address, network: net.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, systemPrompt, network: networkId } = await req.json();
    const net = resolveNetwork(networkId);
    const inft = new ethers.Contract(net.inftAddress, INFT_ABI, net.signer);

    const nextId = Number(await inft.totalAgents());
    const prompt = systemPrompt || "You are a helpful AI with persistent memory.";
    const encrypted = encryptConfig(prompt, PK, nextId);

    const tx = await inft.mintAgent(name || "MindVault Agent", encrypted);
    const receipt = await tx.wait();

    const iface = new ethers.Interface(["event AgentMinted(uint256 indexed tokenId, address indexed owner, string name)"]);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "AgentMinted") {
          return NextResponse.json({ tokenId: Number(parsed.args.tokenId), txHash: receipt.hash, encrypted: true, network: net.id });
        }
      } catch { /* skip */ }
    }
    return NextResponse.json({ error: "Mint succeeded but couldn't parse event" }, { status: 500 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Mint failed" }, { status: 500 });
  }
}
