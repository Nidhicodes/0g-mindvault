"use client";
import { useState } from "react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { MintAgent } from "@/components/MintAgent";
import { AgentList } from "@/components/AgentList";
import { ChatPanel } from "@/components/ChatPanel";
import { MemoryViewer } from "@/components/MemoryViewer";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<"agents" | "chat" | "memory">("agents");
  const [selectedAgent, setSelectedAgent] = useState<{ id: number; name: string } | null>(null);

  function selectAgent(id: number, name: string, view: "chat" | "memory") {
    setSelectedAgent({ id, name });
    setTab(view);
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧠</span>
          <div>
            <h1 className="text-xl font-bold text-white">MindVault</h1>
            <p className="text-xs text-zinc-500">Persistent Memory for AI Agents on 0G</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
            {(["agents", "chat", "memory"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 rounded text-sm capitalize transition ${
                  tab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"
                }`}
              >
                {t === "memory" ? "🧠 Memory" : t === "chat" ? "💬 Chat" : "Agents"}
              </button>
            ))}
          </div>
          <ConnectWallet />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {!isConnected ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">🧠</div>
            <h2 className="text-3xl font-bold text-white">MindVault</h2>
            <p className="text-zinc-400 max-w-md mx-auto">
              AI agents that remember everything, prove every thought, and own their identity — powered by 0G.
            </p>
            <div className="flex justify-center gap-3 text-xs text-zinc-600">
              <span className="bg-zinc-900 px-2 py-1 rounded">0G Storage</span>
              <span className="bg-zinc-900 px-2 py-1 rounded">0G Compute</span>
              <span className="bg-zinc-900 px-2 py-1 rounded">0G Chain</span>
              <span className="bg-zinc-900 px-2 py-1 rounded">ERC-7857 INFT</span>
            </div>
            <div className="pt-4"><ConnectWallet /></div>
          </div>
        ) : tab === "agents" ? (
          <>
            <MintAgent onMinted={() => setRefreshKey((k) => k + 1)} />
            <AgentList refreshKey={refreshKey} onChat={(id, name) => selectAgent(id, name, "chat")} onMemory={(id, name) => selectAgent(id, name, "memory")} />
          </>
        ) : tab === "chat" ? (
          selectedAgent ? (
            <ChatPanel agentId={selectedAgent.id} agentName={selectedAgent.name} />
          ) : (
            <div className="text-zinc-500 text-center py-12">Select an agent from the Agents tab first</div>
          )
        ) : selectedAgent ? (
          <MemoryViewer agentId={selectedAgent.id} agentName={selectedAgent.name} />
        ) : (
          <div className="text-zinc-500 text-center py-12">Select an agent from the Agents tab first</div>
        )}

        {isConnected && (
          <div className="border-t border-zinc-800 pt-6 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-400">0G Integration Proof</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <a href="https://chainscan-galileo.0g.ai/address/0xcfee7588d1C396fa76d1D7f6f2BBC50153775785" target="_blank" className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-emerald-700 transition">
                <div className="text-emerald-400 font-medium">⛓️ INFT Contract</div>
                <div className="text-zinc-500 font-mono mt-1">0xcfee...5785</div>
              </a>
              <a href="https://chainscan-galileo.0g.ai/address/0xd0565f93f450494e8373dE7f33d565E0B5b41089" target="_blank" className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-emerald-700 transition">
                <div className="text-emerald-400 font-medium">📋 Memory Registry</div>
                <div className="text-zinc-500 font-mono mt-1">0xd056...1089</div>
              </a>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="text-emerald-400 font-medium">💾 0G Storage</div>
                <div className="text-zinc-500 mt-1">KV + File persistence</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                <div className="text-emerald-400 font-medium">🔐 0G Compute</div>
                <div className="text-zinc-500 mt-1">TEE-verified inference</div>
              </div>
            </div>
            <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="text-emerald-400 font-medium">🦞 OpenClaw Integration</div>
              <div className="text-zinc-500 text-xs mt-1">
                Agent orchestration via OpenClaw plugin • 0G Compute as provider • Memory tools: store, recall, identity
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
