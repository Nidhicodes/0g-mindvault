import { ZgFile, Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL!;
const INDEXER_RPC = process.env.STORAGE_INDEXER_RPC!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

function getSigner() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.Wallet(PRIVATE_KEY, provider);
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

/// Upload a memory batch to 0G Storage as a JSON file
export async function uploadMemories(memories: Memory[]): Promise<{ rootHash: string; txHash: string }> {
  const data = new TextEncoder().encode(JSON.stringify(memories, null, 2));
  const memData = new MemData(data);
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);

  const indexer = getIndexer();
  const signer = getSigner();
  const [tx, err] = await indexer.upload(memData, RPC_URL, signer);
  if (err) throw new Error(`Upload error: ${err}`);

  const result = tx as { rootHash: string; txHash: string };
  console.log(`✅ Memories uploaded — root: ${result.rootHash}, tx: ${result.txHash}`);
  return result;
}

/// Download memories from 0G Storage by root hash
export async function downloadMemories(rootHash: string, outputPath: string): Promise<Memory[]> {
  const indexer = getIndexer();
  const err = await indexer.download(rootHash, outputPath, true);
  if (err) throw new Error(`Download error: ${err}`);

  const fs = await import("fs");
  const raw = fs.readFileSync(outputPath, "utf-8");
  return JSON.parse(raw) as Memory[];
}

/// Upload a single file (e.g., agent config, large context) to 0G Storage
export async function uploadFile(filePath: string): Promise<{ rootHash: string; txHash: string }> {
  const file = await ZgFile.fromFilePath(filePath);
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr) throw new Error(`Merkle tree error: ${treeErr}`);

  const indexer = getIndexer();
  const signer = getSigner();
  const [tx, err] = await indexer.upload(file, RPC_URL, signer);
  if (err) throw new Error(`Upload error: ${err}`);
  await file.close();

  const result = tx as { rootHash: string; txHash: string };
  console.log(`✅ File uploaded — root: ${result.rootHash}`);
  return result;
}
