import { ZgFile, Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL!;
const INDEXER_RPC = process.env.STORAGE_INDEXER_RPC!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const MAX_RETRIES = 2;

function getSigner() {
  return new ethers.Wallet(PRIVATE_KEY, new ethers.JsonRpcProvider(RPC_URL));
}

function getIndexer() {
  return new Indexer(INDEXER_RPC);
}

export interface Memory {
  id: string;
  agentId: number;
  content: string;
  type: "fact" | "conversation" | "preference" | "skill";
  timestamp: number;
  metadata?: Record<string, string>;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function uploadMemories(memories: Memory[]): Promise<{ rootHash: string; txHash: string }> {
  const data = new TextEncoder().encode(JSON.stringify(memories, null, 2));
  const memData = new MemData(data);
  const [, treeErr] = await memData.merkleTree();
  if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Storage] Upload retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(3000 * attempt);
      }
      const indexer = getIndexer();
      const [tx, err] = await indexer.upload(memData, RPC_URL, getSigner());
      if (err) throw new Error(`Upload error: ${err}`);
      const result = tx as { rootHash: string; txHash: string };
      console.log(`✅ Memories uploaded — root: ${result.rootHash}, tx: ${result.txHash}`);
      return result;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(`Storage upload failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

export async function downloadMemories(rootHash: string, outputPath: string): Promise<Memory[]> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Storage] Download retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(3000 * attempt);
      }
      const indexer = getIndexer();
      const err = await indexer.download(rootHash, outputPath, true);
      if (err) throw new Error(`Download error: ${err}`);
      const fs = await import("fs");
      const raw = fs.readFileSync(outputPath, "utf-8");
      return JSON.parse(raw) as Memory[];
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw new Error(`Storage download failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}

export async function uploadFile(filePath: string): Promise<{ rootHash: string; txHash: string }> {
  const file = await ZgFile.fromFilePath(filePath);
  const [, treeErr] = await file.merkleTree();
  if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);

  const indexer = getIndexer();
  const [tx, err] = await indexer.upload(file, RPC_URL, getSigner());
  if (err) throw new Error(`Upload error: ${err}`);
  await file.close();

  const result = tx as { rootHash: string; txHash: string };
  console.log(`✅ File uploaded — root: ${result.rootHash}`);
  return result;
}
