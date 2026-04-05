import { NextRequest, NextResponse } from "next/server";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const INDEXER_RPC = process.env.STORAGE_INDEXER_RPC || "https://indexer-storage-testnet-turbo.0g.ai";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const { agentId, memories } = await req.json();
    if (!PRIVATE_KEY) {
      return NextResponse.json({ error: "Missing PRIVATE_KEY" }, { status: 500 });
    }

    const data = new TextEncoder().encode(JSON.stringify(memories));
    const memData = new MemData(data);
    const [, treeErr] = await memData.merkleTree();
    if (treeErr) throw new Error(`Merkle tree: ${treeErr}`);

    const indexer = new Indexer(INDEXER_RPC);
    const signer = new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider(RPC_URL));
    const [tx, err] = await indexer.upload(memData, RPC_URL, signer);
    if (err) throw new Error(`Upload: ${err}`);

    const result = tx as { rootHash: string; txHash: string };
    return NextResponse.json({ rootHash: result.rootHash, txHash: result.txHash, agentId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const rootHash = req.nextUrl.searchParams.get("rootHash");
    if (!rootHash) return NextResponse.json({ error: "Missing rootHash" }, { status: 400 });

    const indexer = new Indexer(INDEXER_RPC);
    const tmpPath = `/tmp/mindvault-${rootHash.slice(0, 16)}.json`;
    const err = await indexer.download(rootHash, tmpPath, true);
    if (err) throw new Error(`Download: ${err}`);

    const fs = await import("fs");
    const raw = fs.readFileSync(tmpPath, "utf-8");
    fs.unlinkSync(tmpPath);
    return NextResponse.json({ memories: JSON.parse(raw) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
