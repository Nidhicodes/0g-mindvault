"use client";
import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACTS } from "@/lib/config";
import inftAbi from "@/lib/inft-abi.json";

export function MintAgent({ onMinted }: { onMinted?: () => void }) {
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful AI assistant with persistent memory.");

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function mint() {
    if (!name.trim()) return;
    writeContract({
      address: CONTRACTS.inft,
      abi: inftAbi,
      functionName: "mintAgent",
      args: [name, systemPrompt],
    });
  }

  if (isSuccess) {
    onMinted?.();
    return (
      <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-4 text-emerald-300">
        ✅ Agent &quot;{name}&quot; minted!{" "}
        <a
          href={`https://chainscan-galileo.0g.ai/tx/${hash}`}
          target="_blank"
          className="underline"
        >
          View tx
        </a>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Mint New Agent</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Agent name"
        className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white placeholder-zinc-500"
      />
      <textarea
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        placeholder="System prompt / personality"
        rows={3}
        className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white placeholder-zinc-500 resize-none"
      />
      <button
        onClick={mint}
        disabled={isPending || isConfirming || !name.trim()}
        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white py-2 rounded-lg font-medium transition"
      >
        {isPending ? "Confirm in wallet..." : isConfirming ? "Minting..." : "Mint Agent INFT"}
      </button>
    </div>
  );
}
