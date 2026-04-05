import { NextResponse } from "next/server";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import * as fs from "fs";
import { getNetwork } from "../../../lib/networks";

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const { rootHash, network: networkId } = await req.json();
    if (!rootHash) return NextResponse.json({ error: "rootHash required" }, { status: 400 });

    const net = getNetwork(networkId);
    const indexer = new Indexer(net.storageIndexer);
    const tmp = `/tmp/mindvault-verify-${rootHash.slice(0, 16)}-${Date.now()}.json`;

    const err = await indexer.download(rootHash, tmp, true);
    if (err) return NextResponse.json({ verified: false, error: `Download failed: ${err}`, rootHash, latencyMs: Date.now() - start });

    const raw = fs.readFileSync(tmp, "utf-8");
    fs.unlinkSync(tmp);

    let memories;
    try { memories = JSON.parse(raw); } catch {
      return NextResponse.json({ verified: false, error: "Downloaded data is not valid JSON", rootHash, latencyMs: Date.now() - start });
    }

    const count = Array.isArray(memories) ? memories.length : 0;
    return NextResponse.json({
      verified: true, rootHash, memoryCount: count,
      sampleMemories: Array.isArray(memories) ? memories.slice(0, 5).map((m: { content?: string; type?: string; timestamp?: number }) => ({
        content: m.content?.slice(0, 200), type: m.type, timestamp: m.timestamp,
      })) : [],
      dataSize: raw.length, latencyMs: Date.now() - start,
    });
  } catch (e: unknown) {
    return NextResponse.json({ verified: false, error: e instanceof Error ? e.message : "Verification failed", latencyMs: Date.now() - start }, { status: 500 });
  }
}
