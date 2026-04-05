"use client";
import { useState } from "react";
import { useReadContract } from "wagmi";
import { CONTRACTS } from "@/lib/config";
import inftAbi from "@/lib/inft-abi.json";
import registryAbi from "@/lib/registry-abi.json";

interface MemoryEntry {
  id: string;
  content: string;
  type: string;
  timestamp: number;
  metadata?: Record<string, string>;
}

export function MemoryViewer({ agentId, agentName }: { agentId: number; agentName: string }) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: agent } = useReadContract({
    address: CONTRACTS.inft,
    abi: inftAbi,
    functionName: "getAgent",
    args: [BigInt(agentId)],
  });

  const { data: snapshotCount } = useReadContract({
    address: CONTRACTS.registry,
    abi: registryAbi,
    functionName: "getSnapshotCount",
    args: [BigInt(agentId)],
  });

  const a = agent as { storageRoot: string; updatedAt: bigint } | undefined;

  async function loadMemories() {
    if (!a?.storageRoot) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/memory?rootHash=${a.storageRoot}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMemories(data.memories || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
    setLoading(false);
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl flex flex-col max-h-[500px]">
      <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">🧠 {agentName}&apos;s Memories</h2>
          <p className="text-zinc-500 text-xs">
            {Number(snapshotCount || 0)} snapshots on-chain •{" "}
            {a?.storageRoot ? `Root: ${a.storageRoot.slice(0, 12)}...` : "No memories yet"}
          </p>
        </div>
        <button
          onClick={loadMemories}
          disabled={loading || !a?.storageRoot}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-300 px-3 py-1.5 rounded transition"
        >
          {loading ? "Loading..." : "Fetch from 0G"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {!a?.storageRoot && (
          <div className="text-zinc-600 text-center py-8">No memories stored yet — start chatting!</div>
        )}
        {memories.map((m, i) => (
          <div key={i} className="bg-zinc-800 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                m.metadata?.role === "user" ? "bg-emerald-900 text-emerald-300" : "bg-blue-900 text-blue-300"
              }`}>
                {m.metadata?.role || m.type}
              </span>
              <span className="text-xs text-zinc-500">{new Date(m.timestamp).toLocaleString()}</span>
            </div>
            <p className="text-zinc-300">{m.content}</p>
            {m.metadata?.verified === "true" && (
              <span className="text-xs text-emerald-400">🔐 TEE Verified</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
