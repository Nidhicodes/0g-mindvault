import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { resolveNetwork } from "../../../lib/server-network";

const INFT_ABI = [
  "function updateMemory(uint256 tokenId, string storageRoot, string kvStreamId)",
];
const REG_ABI = [
  "function setWriter(uint256 agentId, address writer)",
  "function recordSnapshot(uint256 agentId, string storageRoot, uint256 memoryCount)",
  "function writers(uint256 agentId) view returns (address)",
];

export async function POST(req: Request) {
  try {
    const { agentId, memories, network: networkId } = await req.json();
    const net = resolveNetwork(networkId);

    const encoded = new TextEncoder().encode(JSON.stringify(memories, null, 2));
    const memData = new MemData(encoded);
    const [, treeErr] = await memData.merkleTree();
    if (treeErr) throw new Error(`Merkle: ${treeErr}`);

    const indexer = new Indexer(net.storageIndexer);
    const [tx, err] = await indexer.upload(memData, net.rpcUrl, net.signer);
    if (err) throw new Error(`Upload: ${err}`);
    const { rootHash, txHash } = tx as { rootHash: string; txHash: string };

    const inft = new ethers.Contract(net.inftAddress, INFT_ABI, net.signer);
    const updateTx = await inft.updateMemory(agentId, rootHash, "");
    await updateTx.wait();

    const registry = new ethers.Contract(net.registryAddress, REG_ABI, net.signer);
    const signerAddr = await net.signer.getAddress();
    try {
      const currentWriter = await registry.writers(agentId);
      if (currentWriter === ethers.ZeroAddress || currentWriter !== signerAddr) {
        const setTx = await registry.setWriter(agentId, signerAddr);
        await setTx.wait();
      }
      const snapTx = await registry.recordSnapshot(agentId, rootHash, memories.length);
      await snapTx.wait();
    } catch { /* snapshot non-critical */ }

    return NextResponse.json({ rootHash, txHash, count: memories.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
