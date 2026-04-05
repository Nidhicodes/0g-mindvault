"use client";
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "@/lib/config";
import inftAbi from "@/lib/inft-abi.json";

interface AgentListProps {
  refreshKey?: number;
  onChat?: (id: number, name: string) => void;
  onMemory?: (id: number, name: string) => void;
}

function AgentCard({ tokenId, onChat, onMemory, onCloned }: {
  tokenId: number;
  onChat?: (id: number, name: string) => void;
  onMemory?: (id: number, name: string) => void;
  onCloned?: () => void;
}) {
  const { data: agent } = useReadContract({
    address: CONTRACTS.inft,
    abi: inftAbi,
    functionName: "getAgent",
    args: [BigInt(tokenId)],
  });

  const { writeContract, data: cloneHash, isPending: cloning } = useWriteContract();
  const { isLoading: confirming, isSuccess: cloned } = useWaitForTransactionReceipt({ hash: cloneHash });

  if (!agent) return null;
  const a = agent as { name: string; storageRoot: string; kvStreamId: string; createdAt: bigint; updatedAt: bigint };

  function clone() {
    writeContract({
      address: CONTRACTS.inft,
      abi: inftAbi,
      functionName: "cloneAgent",
      args: [BigInt(tokenId)],
    });
  }

  if (cloned) {
    onCloned?.();
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-lg">{a.name}</h3>
        <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-400">#{tokenId}</span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-zinc-400">Created: {new Date(Number(a.createdAt) * 1000).toLocaleDateString()}</div>
        {a.storageRoot ? (
          <div className="text-zinc-400">
            Memory Root: <span className="font-mono text-emerald-400">{a.storageRoot.slice(0, 16)}...</span>
          </div>
        ) : (
          <div className="text-amber-400 text-xs">No memories yet — start a conversation</div>
        )}
      </div>

      {cloned && (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-2 text-xs text-emerald-300">
          ✅ Clone created!{" "}
          <a href={`https://chainscan-galileo.0g.ai/tx/${cloneHash}`} target="_blank" className="underline">View tx</a>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => onChat?.(tokenId, a.name)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-sm transition">💬 Chat</button>
        <button onClick={() => onMemory?.(tokenId, a.name)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-sm transition">🧠 Memory</button>
        <button
          onClick={clone}
          disabled={cloning || confirming}
          className="bg-purple-900/50 hover:bg-purple-800/50 disabled:bg-zinc-800 disabled:text-zinc-600 text-purple-300 px-3 py-2 rounded-lg text-sm transition border border-purple-700/50"
          title="ERC-7857 Clone — creates a new agent with same personality but fresh memory"
        >
          {cloning ? "⏳" : confirming ? "⛓️" : "🧬"}
        </button>
      </div>
    </div>
  );
}

function AgentCardWithOwnership({ tokenId, owner, onChat, onMemory, onCloned }: {
  tokenId: number; owner: string;
  onChat?: (id: number, name: string) => void;
  onMemory?: (id: number, name: string) => void;
  onCloned?: () => void;
}) {
  const { data: tokenOwner } = useReadContract({
    address: CONTRACTS.inft,
    abi: inftAbi,
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  });

  if (!tokenOwner || (tokenOwner as string).toLowerCase() !== owner.toLowerCase()) return null;
  return <AgentCard tokenId={tokenId} onChat={onChat} onMemory={onMemory} onCloned={onCloned} />;
}

export function AgentList({ refreshKey, onChat, onMemory }: AgentListProps) {
  const { address } = useAccount();
  const { data: totalAgents, refetch } = useReadContract({
    address: CONTRACTS.inft,
    abi: inftAbi,
    functionName: "totalAgents",
    query: { refetchInterval: 5000 },
  });

  const total = Number(totalAgents || 0);
  const tokenIds = Array.from({ length: total }, (_, i) => i);

  if (!address) return <div className="text-zinc-500 text-center py-8">Connect your wallet to see your agents</div>;
  if (total === 0) return <div className="text-zinc-500 text-center py-8">No agents minted yet. Create your first one!</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Your Agents <span className="text-zinc-500 text-sm">({total} total on chain)</span>
        </h2>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="bg-purple-900/30 border border-purple-700/50 text-purple-300 px-2 py-0.5 rounded">🧬 = ERC-7857 Clone</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tokenIds.map((id) => (
          <AgentCardWithOwnership
            key={`${id}-${refreshKey}`}
            tokenId={id}
            owner={address}
            onChat={onChat}
            onMemory={onMemory}
            onCloned={() => refetch()}
          />
        ))}
      </div>
    </div>
  );
}
