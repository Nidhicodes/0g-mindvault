"use client";
import { useState } from "react";
import { useWriteContract } from "wagmi";
import { CONTRACTS } from "@/lib/config";
import inftAbi from "@/lib/inft-abi.json";

interface Message {
  role: "user" | "assistant";
  content: string;
  verified?: boolean;
}

export function ChatPanel({ agentId, agentName }: { agentId?: number; agentName?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastRootHash, setLastRootHash] = useState<string | null>(null);
  const { writeContract } = useWriteContract();

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      const withReply = [...updated, { role: "assistant" as const, content: data.reply, verified: data.verified }];
      setMessages(withReply);

      // Auto-save to 0G Storage every 4 messages
      if (withReply.length % 4 === 0 && agentId !== undefined) {
        saveMemories(withReply);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: Could not reach inference endpoint." }]);
    }
    setLoading(false);
  }

  async function saveMemories(msgs: Message[]) {
    setSaving(true);
    try {
      const memories = msgs.map((m, i) => ({
        id: `${agentId}-${i}-${Date.now()}`,
        agentId,
        content: m.content,
        type: "conversation" as const,
        timestamp: Date.now(),
        metadata: { role: m.role, verified: String(m.verified ?? false) },
      }));

      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, memories }),
      });
      const data = await res.json();
      if (data.rootHash) {
        setLastRootHash(data.rootHash);
        // Update on-chain memory pointer
        writeContract({
          address: CONTRACTS.inft,
          abi: inftAbi,
          functionName: "updateMemory",
          args: [BigInt(agentId!), data.rootHash, ""],
        });
      }
    } catch {}
    setSaving(false);
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl flex flex-col h-[500px]">
      <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">
            {agentName ? `Chat with ${agentName}` : "Agent Chat"}
          </h2>
          <p className="text-zinc-500 text-xs">Powered by 0G Compute • TEE Verified</p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-amber-400 animate-pulse">💾 Saving to 0G...</span>}
          {lastRootHash && (
            <span className="text-xs text-emerald-400 font-mono" title={lastRootHash}>
              ✅ {lastRootHash.slice(0, 10)}...
            </span>
          )}
          {messages.length > 0 && agentId !== undefined && (
            <button
              onClick={() => saveMemories(messages)}
              disabled={saving}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition"
            >
              Save Memory
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-zinc-600 text-center py-12">
            {agentId !== undefined
              ? "Start a conversation — memories auto-save to 0G Storage"
              : "Select an agent to start chatting"}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                m.role === "user" ? "bg-emerald-700 text-white" : "bg-zinc-800 text-zinc-200"
              }`}
            >
              {m.content}
              {m.verified && (
                <span className="ml-2 text-xs text-emerald-400" title="TEE Verified">🔐</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-400 animate-pulse">Thinking...</div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-700 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message your agent..."
          className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white placeholder-zinc-500 text-sm"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
