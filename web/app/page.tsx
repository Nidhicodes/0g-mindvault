"use client";

import "./globals.css";
import { useEffect, useState, useCallback, useRef } from "react";
import { hasWallet, connectWallet, mintAgentWithWallet, cloneAgentWithWallet } from "../lib/wallet";
import { NETWORKS, DEFAULT_NETWORK, type NetworkConfig } from "../lib/networks";

/* ── Types ── */
interface AgentData {
  tokenId: number; name: string; storageRoot: string; kvStreamId: string;
  encryptedConfig: string; decryptedConfig?: string; createdAt: number; updatedAt: number; owner: string;
  snapshots: { storageRoot: string; timestamp: number; memoryCount: number }[];
}
interface ChatMsg { role: "user" | "assistant" | "system"; content: string; verified?: boolean; model?: string; memories?: string[]; latencyMs?: number; chatId?: string }
interface MemItem { id: string; content: string; type: string; timestamp: number }
interface OCTool { name: string; description: string; parameters: Record<string, string>; flow: string }
interface Toast { id: number; msg: string; type: "success" | "error" }

const sh = (h: string, n = 6) => h?.length > n * 2 + 4 ? `${h.slice(0, n + 2)}…${h.slice(-n)}` : h || "—";
const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/* ── SVG Logo ── */
function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="8" fill="url(#lg)" />
      <path d="M16 7C11 7 8 10.5 8 14c0 2.5 1.2 4 3 5l-.5 4.5c-.1.8.6 1.5 1.4 1.5h8.2c.8 0 1.5-.7 1.4-1.5L21 19c1.8-1 3-2.5 3-5 0-3.5-3-7-8-7z" fill="rgba(255,255,255,0.95)" />
      <circle cx="12.5" cy="14" r="1.5" fill="url(#lg)" />
      <circle cx="19.5" cy="14" r="1.5" fill="url(#lg)" />
      <path d="M13 18c0 0 1.5 1.5 3 1.5s3-1.5 3-1.5" stroke="url(#lg)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <defs><linearGradient id="lg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#a78bfa" /><stop offset="1" stopColor="#7c3aed" /></linearGradient></defs>
    </svg>
  );
}


/* ── Primitives ── */
function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "green" | "blue" | "amber" }) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid var(--accent-border)" },
    green: { background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green-border)" },
    blue: { background: "var(--blue-dim)", color: "var(--blue)", border: "1px solid rgba(96,165,250,0.15)" },
    amber: { background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(251,191,36,0.15)" },
  };
  return <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, fontSize: "0.7rem", fontWeight: 500, letterSpacing: "0.01em", ...styles[variant] }}>{children}</span>;
}

function Btn({ children, onClick, disabled, variant = "primary", style }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "secondary" | "ghost"; style?: React.CSSProperties }) {
  const v: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent-2)", color: "#fff", border: "1px solid rgba(124,58,237,0.5)" },
    secondary: { background: "var(--bg-2)", color: "var(--text-1)", border: "1px solid var(--border)" },
    ghost: { background: "transparent", color: "var(--text-2)", border: "1px solid transparent" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "7px 16px", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", fontWeight: 500,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
      transition: "all 0.15s ease", fontFamily: "var(--sans)", ...v[variant], ...style,
    }}>{children}</button>
  );
}

function Card({ children, style, className = "" }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={className} style={{
      background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
      padding: 20, transition: "border-color 0.2s ease", ...style,
    }} onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
       onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>{children}</div>;
}

function Toasts({ toasts }: { toasts: Toast[] }) {
  return <>{toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</>;
}

function Dot({ color = "var(--green)" }: { color?: string }) {
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />;
}

function NeuralOrb() {
  return (
    <div className="neural-orb">
      <div className="neural-orb-inner">
        <div className="neural-orb-ring" />
        <div className="neural-orb-ring" />
        <div className="neural-orb-ring" />
        <div className="neural-orb-node" />
        <div className="neural-orb-node" />
        <div className="neural-orb-node" />
        <div className="neural-orb-node" />
        <div className="neural-orb-node" />
        <div className="neural-orb-node" />
        <div className="neural-orb-core" />
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════════ */
function DashboardTab({ agents, balance, wallet, onRefresh, onMint, minting, mintStep, addToast, userWallet, network, net }: {
  agents: AgentData[]; balance: string; wallet: string; onRefresh: () => void; onMint: (n: string, p: string) => void; minting: boolean; mintStep: string | null; addToast: (m: string, t: "success" | "error") => void; userWallet: string | null; network: string; net: NetworkConfig;
}) {
  const [showMint, setShowMint] = useState(false);
  const [mintName, setMintName] = useState("MindVault Agent");
  const [mintPrompt, setMintPrompt] = useState("You are a helpful AI with persistent memory on 0G. Remember everything users tell you across sessions.");
  const [cloning, setCloning] = useState<number | null>(null);
  const [timelineAgent, setTimelineAgent] = useState<number | null>(null);
  const totalMem = agents.reduce((s, a) => s + (a.snapshots.length > 0 ? a.snapshots[a.snapshots.length - 1].memoryCount : 0), 0);
  const totalSnaps = agents.reduce((s, a) => s + a.snapshots.length, 0);

  const cloneAgent = async (tokenId: number) => {
    setCloning(tokenId);
    try {
      if (userWallet) {
        const result = await cloneAgentWithWallet(tokenId);
        addToast(`Agent cloned via your wallet — new Token #${result.cloneId}`, "success");
      } else {
        const res = await fetch("/api/agents/clone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenId, network }) });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        addToast(`Agent cloned — new Token #${data.cloneId}`, "success");
      }
      onRefresh();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "Clone failed", "error"); }
    finally { setCloning(null); }
  };

  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-0)", fontSize: "0.85rem", outline: "none" };

  return (
    <div className="fade-in">
      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { v: agents.length, l: "Agents", sub: "ERC-7857 INFTs" },
          { v: totalMem, l: "Memories", sub: "Persisted on 0G" },
          { v: totalSnaps, l: "Snapshots", sub: "On-chain proofs" },
          { v: parseFloat(balance).toFixed(2), l: "Balance", sub: "0G tokens" },
        ].map((s, i) => (
          <div key={i} className="slide-up" style={{ animationDelay: `${i * 40}ms`, background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 14px" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--text-0)", letterSpacing: "-0.03em", lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-1)", marginTop: 4 }}>{s.l}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <Btn onClick={() => setShowMint(!showMint)}>{showMint ? "Cancel" : "+ Mint Agent"}</Btn>
        <Btn variant="secondary" onClick={onRefresh}>Refresh</Btn>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, fontSize: "0.75rem", color: "var(--text-3)" }}>
          <span className="mono">{sh(wallet, 6)}</span>
          <a href={`${net.explorer}/address/${net.inftAddress}`} target="_blank" rel="noopener noreferrer" className="mono">INFT {sh(net.inftAddress, 4)}</a>
          <a href={`${net.explorer}/address/${net.registryAddress}`} target="_blank" rel="noopener noreferrer" className="mono">Registry {sh(net.registryAddress, 4)}</a>
        </div>
      </div>

      {/* Mint Form */}
      {(showMint || minting) && (
        <Card className="slide-up" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-0)", marginBottom: 14 }}>Mint New Agent INFT</div>
          {minting ? (
            <div style={{ padding: "12px 0" }}>
              {[
                { label: "Encrypting agent config with AES-256-GCM", done: mintStep !== "Encrypting agent config with AES-256-GCM..." },
                { label: "Submitting transaction to 0G Chain", done: mintStep !== "Submitting transaction to 0G Chain..." && mintStep !== "Encrypting agent config with AES-256-GCM..." && mintStep !== "Waiting for wallet signature..." },
                { label: "Waiting for on-chain confirmation", done: mintStep === "Agent minted successfully!" },
                { label: "Agent minted successfully", done: mintStep === "Agent minted successfully!" },
              ].map((step, i) => {
                const isActive = mintStep?.toLowerCase().includes(step.label.toLowerCase().slice(0, 10)) || false;
                const isPast = step.done && !isActive;
                return (
                  <div key={i} className={isActive ? "fade-in" : ""} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.65rem", fontWeight: 600,
                      background: isPast ? "var(--green-dim)" : isActive ? "var(--accent-dim)" : "var(--bg-2)",
                      border: `1.5px solid ${isPast ? "var(--green)" : isActive ? "var(--accent)" : "var(--border)"}`,
                      color: isPast ? "var(--green)" : isActive ? "var(--accent)" : "var(--text-3)",
                    }}>
                      {isPast ? "✓" : isActive ? <span className="typing-dots" style={{ transform: "scale(0.5)" }}><span /><span /><span /></span> : (i + 1)}
                    </div>
                    <span style={{
                      fontSize: "0.8rem",
                      color: isPast ? "var(--green)" : isActive ? "var(--text-0)" : "var(--text-3)",
                      fontWeight: isActive ? 500 : 400,
                    }}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <input value={mintName} onChange={e => setMintName(e.target.value)} placeholder="Agent name" style={{ ...inputStyle, marginBottom: 8 }} />
              <textarea value={mintPrompt} onChange={e => setMintPrompt(e.target.value)} placeholder="System prompt" rows={3}
                style={{ ...inputStyle, marginBottom: 12, resize: "vertical", fontFamily: "var(--sans)" }} />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Btn onClick={() => { onMint(mintName, mintPrompt); }} disabled={minting}>
                  Deploy to 0G Chain
                </Btn>
                <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>System prompt encrypted with AES-256-GCM before on-chain storage. Only the owner&apos;s key can decrypt.</span>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Agents */}
      <SectionLabel>Agents</SectionLabel>
      {agents.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "48px 20px" }}>
          <Logo size={40} />
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-0)", marginTop: 16, marginBottom: 6 }}>No agents yet</div>
          <div style={{ color: "var(--text-2)", fontSize: "0.85rem", marginBottom: 16 }}>Mint your first agent INFT to get started</div>
          <code className="mono" style={{ padding: "8px 16px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>npm run demo</code>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: agents.length > 2 ? "1fr 1fr 1fr" : agents.length > 1 ? "1fr 1fr" : "1fr", gap: 12 }}>
          {agents.map((a, idx) => {
            const latest = a.snapshots.length > 0 ? a.snapshots[a.snapshots.length - 1] : null;
            return (
              <Card key={a.tokenId} className="slide-up" style={{ animationDelay: `${idx * 50}ms`, padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-0)", display: "flex", alignItems: "center", gap: 8 }}>
                      <Logo size={18} /> {a.name}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: 3 }}>#{a.tokenId} · <span className="mono">{sh(a.owner, 4)}</span></div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Badge>INFT</Badge>
                    {a.storageRoot && <Badge variant="green"><Dot /> Active</Badge>}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                  {[
                    { l: "Created", v: fmtDate(a.createdAt) },
                    { l: "Snapshots", v: String(a.snapshots.length) },
                    { l: "Root", v: a.storageRoot ? sh(a.storageRoot, 6) : "—", m: true },
                    { l: "Memories", v: latest ? String(latest.memoryCount) : "0" },
                  ].map((x, i) => (
                    <div key={i} style={{ padding: "6px 8px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", fontSize: "0.75rem" }}>
                      <div style={{ color: "var(--text-3)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 1 }}>{x.l}</div>
                      <div style={{ color: "var(--text-1)", ...(x.m ? { fontFamily: "var(--mono)", fontSize: "0.7rem" } : {}) }}>{x.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={`${net.explorer}/address/${net.inftAddress}`} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "4px 10px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.7rem", color: "var(--text-2)" }}>ChainScan ↗</a>
                  {a.storageRoot && <a href={`${net.storageScan}/tx/${a.storageRoot}`} target="_blank" rel="noopener noreferrer"
                    style={{ padding: "4px 10px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.7rem", color: "var(--text-2)" }}>StorageScan ↗</a>}
                  <button onClick={() => cloneAgent(a.tokenId)} disabled={cloning === a.tokenId}
                    style={{ padding: "4px 10px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.7rem", color: "var(--accent)", cursor: "pointer", fontFamily: "var(--sans)" }}>
                    {cloning === a.tokenId ? "Cloning…" : "Clone Agent"}
                  </button>
                  <button onClick={async () => {
                    try {
                      const res = await fetch("/api/agents/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenId: a.tokenId, network }) });
                      const data = await res.json();
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a"); link.href = url; link.download = `mindvault-agent-${a.tokenId}.json`; link.click();
                      URL.revokeObjectURL(url);
                      addToast(`Exported agent #${a.tokenId}`, "success");
                    } catch { addToast("Export failed", "error"); }
                  }} style={{ padding: "4px 10px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.7rem", color: "var(--text-2)", cursor: "pointer", fontFamily: "var(--sans)" }}>
                    Export
                  </button>
                  {a.snapshots.length > 0 && (
                    <button onClick={() => setTimelineAgent(timelineAgent === a.tokenId ? null : a.tokenId)}
                      style={{ padding: "4px 10px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.7rem", color: "var(--text-2)", cursor: "pointer", fontFamily: "var(--sans)" }}>
                      {timelineAgent === a.tokenId ? "Hide Timeline" : "Timeline"}
                    </button>
                  )}
                </div>
                {/* Memory Timeline */}
                {timelineAgent === a.tokenId && a.snapshots.length > 0 && (
                  <div className="slide-up" style={{ marginTop: 10 }}>
                    <div style={{ position: "relative", paddingLeft: 16 }}>
                      <div style={{ position: "absolute", left: 5, top: 0, bottom: 0, width: 1, background: "var(--accent-border)" }} />
                      {a.snapshots.slice().reverse().map((snap, si) => (
                        <div key={si} style={{ position: "relative", paddingBottom: 10, paddingLeft: 14 }}>
                          <div style={{ position: "absolute", left: -1, top: 4, width: 8, height: 8, borderRadius: "50%", background: si === 0 ? "var(--accent)" : "var(--bg-3)", border: `2px solid ${si === 0 ? "var(--accent)" : "var(--text-3)"}` }} />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem" }}>
                            <span style={{ color: "var(--text-1)" }}>{snap.memoryCount} memories</span>
                            <span style={{ color: "var(--text-3)" }}>{fmtDate(snap.timestamp)}</span>
                          </div>
                          <div className="mono" style={{ fontSize: "0.65rem", marginTop: 1 }}>{sh(snap.storageRoot, 10)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {latest && (
                  <div style={{ marginTop: 10, padding: "7px 10px", background: "var(--green-dim)", border: "1px solid var(--green-border)", borderRadius: "var(--radius-sm)", fontSize: "0.7rem", display: "flex", alignItems: "center", gap: 6 }}>
                    <Dot /> <span style={{ color: "var(--text-1)" }}>{latest.memoryCount} memories verified on-chain</span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════
   CHAT
   ══════════════════════════════════════════════ */
function ChatTab({ agents, addToast, network, net }: { agents: AgentData[]; addToast: (m: string, t: "success" | "error") => void; network: string; net: NetworkConfig }) {
  const [agentId, setAgentId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mems, setMems] = useState<MemItem[]>([]);
  const [persisting, setPersisting] = useState(false);
  const [persistResult, setPersistResult] = useState<{ rootHash: string; txHash: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [shareSource, setShareSource] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; memoryCount: number; latencyMs: number } | null>(null);
  const [computeAvailable, setComputeAvailable] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const agent = agents.find(a => a.tokenId === agentId);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  // Check compute availability on mount
  useEffect(() => {
    fetch("/api/services").then(r => r.json()).then(d => {
      const svc = d.services || [];
      setComputeAvailable(svc.some((s: { type: string }) => s.type === "chatbot"));
    }).catch(() => setComputeAvailable(false));
  }, []);

  const addManualMemory = (content: string) => {
    if (!content.trim() || content.length < 4) return;
    setMems(p => [...p, { id: `manual_${Date.now()}`, content: content.trim(), type: "fact", timestamp: Date.now() }]);
    addToast("Memory added manually", "success");
  };

  const send = async () => {
    if (!input.trim() || loading || agentId === null) return;
    const text = input; setInput(""); setLoading(true);
    setMsgs(p => [...p, { role: "user", content: text }]);

    const sys = agent?.decryptedConfig || agent?.encryptedConfig || "You are a helpful AI with persistent memory.";
    const allMsgs = [
      { role: "system", content: `${sys}\n\nYour persistent memories:\n${mems.map(m => `[${m.type}] ${m.content}`).join("\n")}\n\nAfter responding, output new facts on separate lines prefixed with [MEMORY]:` },
      ...msgs.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: text },
    ];

    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: allMsgs }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const parts = data.content.split(/\[MEMORY\]:\s*/);
      const reply = parts[0].trim();
      const newMems: string[] = [];
      for (let i = 1; i < parts.length; i++) {
        const mc = parts[i].split("\n")[0].trim();
        if (mc && mc.length > 3) { newMems.push(mc); setMems(p => [...p, { id: `m_${Date.now()}_${i}`, content: mc, type: "fact", timestamp: Date.now() }]); }
      }

      // If no memories found via [MEMORY]: tags, try JSON extraction from response
      if (newMems.length === 0) {
        try {
          const jsonMatch = data.content.match(/```(?:json)?\s*([\s\S]*?)```/) || data.content.match(/(\[[\s\S]*?\])/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed)) {
              for (const m of parsed) {
                if (m.content && m.content.length > 3) {
                  newMems.push(m.content);
                  setMems(p => [...p, { id: `m_${Date.now()}_${Math.random()}`, content: m.content, type: m.type || "fact", timestamp: Date.now() }]);
                }
              }
            }
          }
        } catch { /* not JSON, that's fine */ }
      }

      setMsgs(p => [...p, { role: "assistant", content: reply, verified: data.verified, model: data.model, memories: newMems, latencyMs: data.latencyMs, chatId: data.chatId }]);
      if (newMems.length > 0) addToast(`${newMems.length} new ${newMems.length === 1 ? "memory" : "memories"} extracted`, "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      const isNoProvider = msg.includes("No chatbot service") || msg.includes("503");
      const display = isNoProvider
        ? "No 0G Compute providers available right now. Providers rotate availability on testnet. You can still restore memories, share between agents, and persist — just chat is temporarily unavailable."
        : msg;
      setMsgs(p => [...p, { role: "assistant", content: display }]);
      if (isNoProvider) setComputeAvailable(false);
      addToast(isNoProvider ? "0G Compute unavailable — try again shortly" : msg, "error");
    } finally { setLoading(false); inputRef.current?.focus(); }
  };

  const persist = async () => {
    if (mems.length === 0 || agentId === null) return;
    setPersisting(true);
    try {
      const res = await fetch("/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId, memories: mems, network }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPersistResult(data);
      addToast(`${mems.length} memories persisted to 0G Storage`, "success");
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setPersisting(false); }
  };

  const restoreMemories = async () => {
    if (agentId === null) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/memory/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId, network }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.memories || data.memories.length === 0) { addToast("No stored memories found for this agent", "error"); return; }
      const restored: MemItem[] = data.memories.map((m: { id?: string; content: string; type?: string; timestamp?: number }, i: number) => ({
        id: m.id || `restored_${i}`, content: m.content, type: m.type || "fact", timestamp: m.timestamp || Date.now(),
      }));
      setMems(restored);
      addToast(`Restored ${restored.length} memories from 0G Storage (root: ${sh(data.rootHash, 8)})`, "success");
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "Restore failed", "error"); }
    finally { setRestoring(false); }
  };

  const shareMemories = async () => {
    if (shareSource === null || agentId === null || shareSource === agentId) return;
    setSharing(true);
    try {
      const res = await fetch("/api/memory/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceAgentId: shareSource, targetAgentId: agentId, network }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const shared: MemItem[] = data.memories.map((m: { id?: string; content: string; type?: string; timestamp?: number }, i: number) => ({
        id: m.id || `shared_${i}`, content: m.content, type: m.type || "fact", timestamp: m.timestamp || Date.now(),
      }));
      setMems(prev => [...prev, ...shared]);
      addToast(`Imported ${shared.length} memories from "${data.sourceAgent.name}" into current session`, "success");
      setShareSource(null);
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "Share failed", "error"); }
    finally { setSharing(false); }
  };

  const verifyRoot = async (rootHash: string) => {
    setVerifying(rootHash);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rootHash, network }) });
      const data = await res.json();
      setVerifyResult({ verified: data.verified, memoryCount: data.memoryCount || 0, latencyMs: data.latencyMs || 0 });
      addToast(data.verified ? `Verified: ${data.memoryCount} memories intact` : "Verification failed", data.verified ? "success" : "error");
    } catch { addToast("Verification request failed", "error"); }
    finally { setVerifying(null); }
  };

  const selectStyle: React.CSSProperties = { flex: 1, padding: "8px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-0)", fontSize: "0.85rem", outline: "none" };

  return (
    <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 12, height: "calc(100vh - 170px)", minHeight: 460 }}>
      <Card style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
          <select value={agentId ?? ""} onChange={e => { setAgentId(Number(e.target.value)); setMsgs([]); setMems([]); setPersistResult(null); }} style={selectStyle}>
            <option value="" disabled>Select an agent…</option>
            {agents.map(a => <option key={a.tokenId} value={a.tokenId}>{a.name} (#{a.tokenId})</option>)}
          </select>
          {agent && <><Badge variant={computeAvailable === false ? "amber" : "green"}><Dot color={computeAvailable === false ? "var(--amber)" : "var(--green)"} /> {computeAvailable === false ? "Compute Offline" : "0G Compute"}</Badge><Badge variant="blue">TEE</Badge></>}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {agentId === null ? (
            <div style={{ textAlign: "center", padding: "56px 20px" }}>
              <Logo size={36} />
              <div style={{ fontSize: "0.95rem", color: "var(--text-0)", marginTop: 14, fontWeight: 500 }}>Select an agent to chat</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: 4 }}>Inference via 0G Compute with TEE verification</div>
            </div>
          ) : msgs.length === 0 && !loading ? (
            <div style={{ textAlign: "center", padding: "56px 20px" }}>
              <Logo size={36} />
              <div style={{ fontSize: "0.95rem", color: "var(--text-0)", marginTop: 14, fontWeight: 500 }}>Chat with {agent?.name}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: 4 }}>Memories are extracted and can be persisted to 0G Storage</div>
            </div>
          ) : msgs.map((m, i) => (
            <div key={i} className="fade-in" style={{ marginBottom: 12, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "80%", padding: "9px 13px", borderRadius: "var(--radius)", fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap",
                background: m.role === "user" ? "var(--accent-2)" : "var(--bg-2)",
                color: m.role === "user" ? "#fff" : "var(--text-0)",
                borderBottomRightRadius: m.role === "user" ? 3 : "var(--radius)",
                borderBottomLeftRadius: m.role === "user" ? "var(--radius)" : 3,
              }}>{m.content}</div>
              {m.role === "assistant" && (
                <div style={{ display: "flex", gap: 6, marginTop: 3, fontSize: "0.7rem", color: "var(--text-3)", flexWrap: "wrap" }}>
                  {m.verified !== undefined && <span style={{ color: m.verified ? "var(--green)" : "var(--amber)" }}>{m.verified ? "✓ TEE Verified" : "⚠ Unverified"}</span>}
                  {m.model && <span>· {m.model}</span>}
                  {m.latencyMs && <span>· {(m.latencyMs / 1000).toFixed(1)}s</span>}
                  {m.memories && m.memories.length > 0 && <span style={{ color: "var(--accent)" }}>· {m.memories.length} {m.memories.length === 1 ? "memory" : "memories"}</span>}
                </div>
              )}
              {/* Sealed Inference Proof Card */}
              {m.role === "assistant" && m.chatId && (
                <div className="fade-in" style={{ marginTop: 6, padding: "6px 10px", background: m.verified ? "var(--green-dim)" : "var(--amber-dim)", border: `1px solid ${m.verified ? "var(--green-border)" : "rgba(251,191,36,0.15)"}`, borderRadius: "var(--radius-sm)", fontSize: "0.65rem", maxWidth: "80%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                    <Dot color={m.verified ? "var(--green)" : "var(--amber)"} />
                    <span style={{ fontWeight: 600, color: m.verified ? "var(--green)" : "var(--amber)" }}>
                      {m.verified ? "Sealed Inference — TEE Verified" : "Inference — Verification Pending"}
                    </span>
                  </div>
                  <div className="mono" style={{ color: "var(--text-3)" }}>
                    Chat ID: {sh(m.chatId, 10)} · Model: {m.model}
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && <div className="fade-in" style={{ marginBottom: 12 }}><div style={{ display: "inline-block", padding: "10px 16px", background: "var(--bg-2)", borderRadius: "var(--radius)", borderBottomLeftRadius: 3 }}><div className="typing-dots"><span /><span /><span /></div></div></div>}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={agentId === null ? "Select an agent first…" : "Message…"} disabled={agentId === null || loading}
            style={{ flex: 1, padding: "9px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-0)", fontSize: "0.85rem", outline: "none" }} />
          <Btn onClick={send} disabled={!input.trim() || loading || agentId === null}>{loading ? "…" : "Send"}</Btn>
        </div>
      </Card>

      {/* Memory Sidebar */}
      <Card style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-0)" }}>Memories ({mems.length})</span>
          <Btn variant="ghost" onClick={persist} disabled={mems.length === 0 || persisting} style={{ fontSize: "0.7rem", padding: "4px 10px" }}>
            {persisting ? "Saving…" : "Persist to 0G"}
          </Btn>
        </div>
        {/* Restore + Share controls */}
        {agentId !== null && (
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button onClick={restoreMemories} disabled={restoring}
              style={{ padding: "3px 8px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.65rem", color: "var(--accent)", cursor: "pointer", fontFamily: "var(--sans)" }}>
              {restoring ? "Loading…" : "↓ Restore from 0G"}
            </button>
            <select value={shareSource ?? ""} onChange={e => setShareSource(Number(e.target.value))}
              style={{ padding: "3px 6px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.65rem", color: "var(--text-1)", outline: "none", flex: 1, minWidth: 0 }}>
              <option value="" disabled>Import from…</option>
              {agents.filter(a => a.tokenId !== agentId && a.storageRoot).map(a => <option key={a.tokenId} value={a.tokenId}>{a.name} (#{a.tokenId})</option>)}
            </select>
            {shareSource !== null && (
              <button onClick={shareMemories} disabled={sharing}
                style={{ padding: "3px 8px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius-sm)", fontSize: "0.65rem", color: "var(--accent)", cursor: "pointer", fontFamily: "var(--sans)" }}>
                {sharing ? "…" : "Share"}
              </button>
            )}
          </div>
        )}
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {mems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-3)", fontSize: "0.75rem", lineHeight: 1.6 }}>Memories appear as the agent learns from conversation</div>
          ) : mems.map((m, i) => (
            <div key={i} className="fade-in" style={{ padding: "6px 8px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", marginBottom: 4, borderLeft: "2px solid var(--accent)", fontSize: "0.75rem" }}>
              <div style={{ color: "var(--text-1)", lineHeight: 1.4 }}>{m.content}</div>
              <div style={{ color: "var(--text-3)", fontSize: "0.65rem", marginTop: 2 }}>{m.type} · {new Date(m.timestamp).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
        {/* Manual memory input */}
        {agentId !== null && (
          <div style={{ padding: "6px 10px", borderTop: "1px solid var(--border)" }}>
            <form onSubmit={e => { e.preventDefault(); const inp = (e.target as HTMLFormElement).elements.namedItem("mem") as HTMLInputElement; addManualMemory(inp.value); inp.value = ""; }} style={{ display: "flex", gap: 4 }}>
              <input name="mem" placeholder="Add memory manually…" style={{ flex: 1, padding: "4px 8px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.65rem", color: "var(--text-0)", outline: "none" }} />
              <button type="submit" style={{ padding: "4px 8px", background: "var(--accent-dim)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius-sm)", fontSize: "0.65rem", color: "var(--accent)", cursor: "pointer", fontFamily: "var(--sans)" }}>+</button>
            </form>
          </div>
        )}
        {persistResult && (
          <div className="slide-up" style={{ padding: 10, borderTop: "1px solid var(--border)", fontSize: "0.7rem" }}>
            <div style={{ color: "var(--green)", fontWeight: 500, marginBottom: 3, display: "flex", alignItems: "center", gap: 4 }}><Dot /> Persisted to 0G Storage</div>
            <div className="mono" style={{ wordBreak: "break-all", marginBottom: 3 }}>{sh(persistResult.rootHash, 14)}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <a href={`${net.storageScan}/tx/${persistResult.rootHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.7rem" }}>StorageScan ↗</a>
              <button onClick={() => verifyRoot(persistResult.rootHash)} disabled={verifying !== null}
                style={{ padding: "2px 8px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "0.65rem", color: "var(--accent)", cursor: "pointer", fontFamily: "var(--sans)" }}>
                {verifying ? "Verifying…" : "Verify Proof"}
              </button>
            </div>
            {verifyResult && (
              <div style={{ marginTop: 6, padding: "5px 8px", background: verifyResult.verified ? "var(--green-dim)" : "rgba(248,113,113,0.08)", borderRadius: "var(--radius-sm)", fontSize: "0.65rem" }}>
                <span style={{ color: verifyResult.verified ? "var(--green)" : "var(--red)" }}>
                  {verifyResult.verified ? `✓ Verified: ${verifyResult.memoryCount} memories intact (${verifyResult.latencyMs}ms)` : "✗ Verification failed"}
                </span>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}


/* ══════════════════════════════════════════════
   OPENCLAW
   ══════════════════════════════════════════════ */
function OpenClawTab() {
  const [data, setData] = useState<{ config: Record<string, unknown>; tools: OCTool[]; hooks: { event: string; action: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/openclaw").then(r => r.json()).then(setData).finally(() => setLoading(false)); }, []);
  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "var(--text-3)" }}>Loading…</div>;
  if (!data) return null;

  return (
    <div className="fade-in">
      <Card style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: "var(--radius)", background: "linear-gradient(135deg, #f59e0b, #ef4444)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-0)" }}>MindVault OpenClaw Plugin</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: 3, lineHeight: 1.5 }}>Exposes 0G Storage and Chain as OpenClaw tools. Agents gain persistent memory and on-chain identity via ERC-7857 INFTs.</div>
        </div>
        <Badge variant="green"><Dot /> Active</Badge>
      </Card>

      {/* Flow */}
      <SectionLabel>Integration Flow</SectionLabel>
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr 24px 1fr", alignItems: "center", textAlign: "center", fontSize: "0.8rem" }}>
          {[
            { label: "OpenClaw Agent", sub: "Orchestrates tools", bg: "var(--bg-2)" },
            null,
            { label: "MindVault Plugin", sub: "3 tools + hooks", bg: "var(--accent-dim)", border: "var(--accent-border)" },
            null,
            { label: "0G Infrastructure", sub: "Storage + Chain", bg: "var(--bg-2)" },
          ].map((item, i) => item ? (
            <div key={i} style={{ padding: 14, background: item.bg, borderRadius: "var(--radius)", border: `1px solid ${item.border || "var(--border)"}` }}>
              <div style={{ fontWeight: 600, color: "var(--text-0)" }}>{item.label}</div>
              <div style={{ color: "var(--text-3)", marginTop: 2, fontSize: "0.7rem" }}>{item.sub}</div>
            </div>
          ) : (
            <div key={i} style={{ color: "var(--text-3)", fontSize: "0.9rem" }}>→</div>
          ))}
        </div>
      </Card>

      <SectionLabel>Tools ({data.tools.length})</SectionLabel>
      <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        {data.tools.map((t, i) => (
          <Card key={i} className="slide-up" style={{ animationDelay: `${i * 60}ms`, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <code style={{ fontFamily: "var(--mono)", fontSize: "0.85rem", color: "var(--accent)", fontWeight: 600 }}>{t.name}</code>
              <Badge>Tool</Badge>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-2)", marginBottom: 10, lineHeight: 1.5 }}>{t.description}</div>
            <div style={{ marginBottom: 8 }}>
              {Object.entries(t.parameters).map(([k, v], j) => (
                <div key={j} style={{ display: "flex", gap: 8, fontSize: "0.75rem", marginBottom: 2 }}>
                  <code style={{ fontFamily: "var(--mono)", color: "var(--blue)", minWidth: 70 }}>{k}</code>
                  <span style={{ color: "var(--text-3)" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "6px 10px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text-3)", lineHeight: 1.5 }}>{t.flow}</div>
          </Card>
        ))}
      </div>

      <SectionLabel>Hooks</SectionLabel>
      {data.hooks.map((h, i) => (
        <Card key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)", background: "var(--amber-dim)", border: "1px solid rgba(251,191,36,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2.5" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-0)" }}>{h.event}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>{h.action}</div>
          </div>
        </Card>
      ))}

      <SectionLabel>Configuration</SectionLabel>
      <Card><pre style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text-2)", lineHeight: 1.6, overflowX: "auto", margin: 0 }}>{JSON.stringify(data.config, null, 2)}</pre></Card>
    </div>
  );
}


/* ══════════════════════════════════════════════
   ARCHITECTURE
   ══════════════════════════════════════════════ */

function ArchNode({ label, sub, accent, glow }: { label: string; sub: string; accent?: boolean; glow?: string }) {
  return (
    <div style={{
      padding: "14px 16px", background: accent ? "var(--accent-dim)" : "var(--bg-2)",
      border: `1px solid ${accent ? "var(--accent-border)" : "var(--border)"}`,
      borderRadius: "var(--radius)", textAlign: "center", position: "relative",
      boxShadow: glow ? `0 0 20px ${glow}, 0 0 4px ${glow}` : "none",
      transition: "box-shadow 0.3s ease",
    }}>
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: accent ? "var(--accent)" : "var(--text-0)" }}>{label}</div>
      <div style={{ fontSize: "0.65rem", color: "var(--text-3)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function ArchArrow({ vertical, label }: { vertical?: boolean; label?: string }) {
  if (vertical) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 0" }}>
      <div style={{ width: 1, height: 16, background: "linear-gradient(to bottom, var(--accent-border), var(--accent))" }} />
      {label && <span style={{ fontSize: "0.55rem", color: "var(--text-3)", letterSpacing: "0.05em" }}>{label}</span>}
      <div style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "5px solid var(--accent)" }} />
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <div style={{ height: 1, flex: 1, background: "linear-gradient(to right, var(--accent-border), var(--accent))" }} />
      <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "5px solid var(--accent)" }} />
    </div>
  );
}

function ArchTab() {
  const [services, setServices] = useState<{ provider: string; model: string; type: string; inputPrice: string; outputPrice: string }[]>([]);
  const [svcLoading, setSvcLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    fetch("/api/services", { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setServices(d.services || []))
      .catch(() => {})
      .finally(() => { clearTimeout(timer); setSvcLoading(false); });
  }, []);

  const items = [
    { title: "0G Storage", status: "Integrated", desc: "Merkle-verified memory persistence. Upload, download, restore, cross-agent sharing.", variant: "green" as const, icon: "📦" },
    { title: "0G Compute", status: "Integrated", desc: "TEE Sealed Inference via Qwen 2.5 7B. On-chain billing. Two-pass memory extraction.", variant: "green" as const, icon: "⚡" },
    { title: "0G Chain", status: "Deployed", desc: "MindVaultINFT (ERC-7857) + MemoryRegistry. Mainnet + Testnet.", variant: "green" as const, icon: "⛓" },
    { title: "Agent ID (INFT)", status: "ERC-7857", desc: "Transferable, clonable, encrypted config. True ownership of AI intelligence.", variant: "default" as const, icon: "🪪" },
    { title: "OpenClaw", status: "Compatible", desc: "3 tools + auto-persist hook. Any OpenClaw gateway gains persistent memory.", variant: "blue" as const, icon: "🔌" },
  ];

  return (
    <div className="fade-in">
      {/* Visual Architecture Diagram */}
      <SectionLabel>System Architecture</SectionLabel>
      <Card style={{ padding: 24, marginBottom: 24 }}>
        {/* Layer 1: Frontend */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 0, marginBottom: 0 }}>
          <ArchNode label="MindVault Explorer" sub="Next.js · Dashboard · Chat · Memory Viewer · OpenClaw" accent glow="rgba(167,139,250,0.1)" />
        </div>
        <ArchArrow vertical label="API Routes" />

        {/* Layer 2: Runtime + INFT Manager */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 0, alignItems: "center" }}>
          <ArchNode label="Agent Runtime" sub="chat → extract → persist → restore → share" />
          <div />
          <ArchNode label="INFT Manager" sub="mint · clone · transfer · encrypt" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
          <ArchArrow vertical label="memories" />
          <ArchArrow vertical label="inference" />
          <ArchArrow vertical label="on-chain" />
        </div>

        {/* Layer 3: 0G Infrastructure */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div style={{ padding: "12px 10px", background: "rgba(52,211,153,0.06)", border: "1px solid var(--green-border)", borderRadius: "var(--radius)", textAlign: "center" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--green)" }}>0G Storage</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", marginTop: 3, lineHeight: 1.4 }}>Merkle Proofs · JSON<br/>Upload · Download · Verify</div>
          </div>
          <div style={{ padding: "12px 10px", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: "var(--radius)", textAlign: "center" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--blue)" }}>0G Compute</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", marginTop: 3, lineHeight: 1.4 }}>TEE Sealed Inference<br/>Qwen 2.5 · DeepSeek V3</div>
          </div>
          <div style={{ padding: "12px 10px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: "var(--radius)", textAlign: "center" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--amber)" }}>0G Chain</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", marginTop: 3, lineHeight: 1.4 }}>MindVaultINFT · Registry<br/>ERC-7857 · Snapshots</div>
          </div>
        </div>

        {/* OpenClaw Plugin Layer */}
        <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--bg-2)", border: "1px dashed var(--border)", borderRadius: "var(--radius)", display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>OpenClaw Plugin</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["store_memory → Storage + Chain", "recall_memory → Chain + Storage", "get_agent → Chain read", "agent_end → Auto-persist"].map((t, i) => (
              <span key={i} className="mono" style={{ fontSize: "0.6rem", padding: "2px 6px", background: "var(--bg-1)", borderRadius: 4, border: "1px solid var(--border)" }}>{t}</span>
            ))}
          </div>
        </div>
      </Card>

      {/* Integration Stack */}
      <SectionLabel>Integration Stack</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {items.map((item, i) => (
          <Card key={i} className="slide-up" style={{ animationDelay: `${i * 50}ms`, padding: 14, ...(i === items.length - 1 && items.length % 2 !== 0 ? { gridColumn: "1 / -1" } : {}) }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.2rem", lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-0)" }}>{item.title}</span>
                  <Badge variant={item.variant}>{item.status}</Badge>
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-2)", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Live Compute Services */}
      <SectionLabel>Live 0G Compute Services</SectionLabel>
      <Card style={{ marginBottom: 24 }}>
        {svcLoading ? (
          <div style={{ textAlign: "center", padding: 16, color: "var(--text-3)", fontSize: "0.8rem" }}>Discovering services…</div>
        ) : services.length === 0 ? (
          <div style={{ textAlign: "center", padding: 16, color: "var(--text-3)", fontSize: "0.8rem" }}>No active providers discovered. 0G Compute is operational — providers rotate availability.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {services.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", fontSize: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Dot />
                  <span style={{ color: "var(--text-0)", fontWeight: 500 }}>{s.model}</span>
                  <Badge variant={s.type === "chatbot" ? "green" : "default"}>{s.type}</Badge>
                </div>
                <span className="mono" style={{ color: "var(--text-3)" }}>{sh(s.provider, 6)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Data Flow */}
      <SectionLabel>Data Flow</SectionLabel>
      <Card>
        <div style={{ display: "grid", gap: 0 }}>
          {[
            { n: "1", l: "User sends message", d: "Via web UI or OpenClaw gateway", c: "var(--text-0)" },
            { n: "2", l: "Semantic memory retrieval", d: "Score relevance, pick top 20 + recent 5", c: "var(--accent)" },
            { n: "3", l: "0G Compute inference", d: "TEE Sealed Inference, on-chain billing", c: "var(--blue)" },
            { n: "4", l: "Two-pass memory extraction", d: "Tag parsing → JSON fallback → conflict resolution", c: "var(--accent)" },
            { n: "5", l: "Persist to 0G Storage", d: "JSON → Merkle tree → root hash → on-chain update", c: "var(--green)" },
            { n: "6", l: "On-chain state update", d: "INFT.updateMemory + Registry.recordSnapshot", c: "var(--amber)" },
          ].map((s, i, arr) => (
            <div key={i}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${s.c}15`, border: `1.5px solid ${s.c}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: s.c, flexShrink: 0 }}>{s.n}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-0)" }}>{s.l}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>{s.d}</div>
                </div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ marginLeft: 13, width: 1, height: 12, background: `linear-gradient(to bottom, ${s.c}40, ${arr[i+1].c}40)` }} />
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}


/* ══════════════════════════════════════════════
   MARKETPLACE
   ══════════════════════════════════════════════ */
interface MarketListing {
  tokenId: number; seller: string; price: string; priceWei: string;
  name: string; storageRoot: string; createdAt: number;
}

function MarketplaceTab({ agents, addToast, userWallet, onRefresh }: {
  agents: AgentData[]; addToast: (m: string, t: "success" | "error") => void; userWallet: string | null; onRefresh: () => void;
}) {
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listModal, setListModal] = useState<number | null>(null);
  const [listPrice, setListPrice] = useState("0.01");
  const [acting, setActing] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/marketplace");
      const data = await res.json();
      setListings(data.listings || []);
      setEnabled(data.enabled || false);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadListings(); }, [loadListings]);

  const doList = async (tokenId: number) => {
    setActing(`list-${tokenId}`);
    try {
      const res = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", tokenId, price: listPrice }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      addToast(`Agent #${tokenId} listed for ${listPrice} 0G`, "success");
      setListModal(null);
      loadListings();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "List failed", "error"); }
    finally { setActing(null); }
  };

  const doDelist = async (tokenId: number) => {
    setActing(`delist-${tokenId}`);
    try {
      const res = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delist", tokenId }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      addToast(`Agent #${tokenId} delisted`, "success");
      loadListings();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "Delist failed", "error"); }
    finally { setActing(null); }
  };

  const doBuy = async (tokenId: number) => {
    setActing(`buy-${tokenId}`);
    try {
      const res = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "buy", tokenId }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      addToast(`Purchased agent #${tokenId}`, "success");
      loadListings();
      onRefresh();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "Buy failed", "error"); }
    finally { setActing(null); }
  };

  const listedIds = new Set(listings.map(l => l.tokenId));
  const myUnlisted = agents.filter(a => !listedIds.has(a.tokenId));

  if (!enabled) {
    return (
      <div className="fade-in">
        <Card style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-0)", marginBottom: 8 }}>Agent Marketplace</div>
          <div style={{ color: "var(--text-2)", fontSize: "0.85rem", marginBottom: 16, lineHeight: 1.6 }}>
            Trade trained AI agent INFTs with verified memory histories.<br/>
            Deploy the AgentMarketplace contract and set MARKETPLACE_ADDRESS in .env to enable.
          </div>
          <code className="mono" style={{ padding: "8px 16px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "0.75rem" }}>npm run deploy</code>
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <Card style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: "var(--radius)", background: "linear-gradient(135deg, #34d399, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-0)" }}>Agent Marketplace</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: 3, lineHeight: 1.5 }}>Buy and sell trained AI agent INFTs. Each agent carries verified memory history and encrypted personality on-chain.</div>
        </div>
        <Badge variant="green"><Dot /> {listings.length} Listed</Badge>
      </Card>

      {/* List an agent */}
      <SectionLabel>Your Agents</SectionLabel>
      {myUnlisted.length === 0 && listings.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "32px 20px", marginBottom: 20 }}>
          <div style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>No agents to list. Mint one from the Dashboard tab.</div>
        </Card>
      ) : myUnlisted.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          {myUnlisted.map(a => (
            <Card key={a.tokenId} style={{ padding: 14 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-0)", marginBottom: 4 }}>{a.name}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginBottom: 8 }}>#{a.tokenId} · {a.snapshots.length > 0 ? `${a.snapshots[a.snapshots.length - 1].memoryCount} memories` : "No memories"}</div>
              {listModal === a.tokenId ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="Price in 0G"
                    style={{ flex: 1, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-0)", fontSize: "0.75rem", outline: "none" }} />
                  <Btn onClick={() => doList(a.tokenId)} disabled={acting !== null} style={{ padding: "5px 10px", fontSize: "0.7rem" }}>
                    {acting === `list-${a.tokenId}` ? "..." : "Confirm"}
                  </Btn>
                  <Btn variant="ghost" onClick={() => setListModal(null)} style={{ padding: "5px 8px", fontSize: "0.7rem" }}>X</Btn>
                </div>
              ) : (
                <Btn variant="secondary" onClick={() => setListModal(a.tokenId)} style={{ width: "100%", fontSize: "0.75rem", padding: "5px 0" }}>List for Sale</Btn>
              )}
            </Card>
          ))}
        </div>
      ) : null}

      {/* Active listings */}
      <SectionLabel>For Sale ({listings.length})</SectionLabel>
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-3)", fontSize: "0.8rem" }}>Loading listings...</div>
      ) : listings.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "32px 20px" }}>
          <div style={{ color: "var(--text-2)", fontSize: "0.85rem" }}>No agents listed for sale yet. Be the first.</div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {listings.map(l => (
            <Card key={l.tokenId} className="slide-up" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-0)" }}>{l.name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: 2 }}>#{l.tokenId} · Seller: <span className="mono">{sh(l.seller, 4)}</span></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--green)" }}>{l.price} 0G</div>
                  <Badge variant="green">For Sale</Badge>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                <div style={{ padding: "5px 8px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", fontSize: "0.7rem" }}>
                  <div style={{ color: "var(--text-3)", fontSize: "0.6rem", textTransform: "uppercase" }}>Storage Root</div>
                  <div className="mono" style={{ color: "var(--text-1)", fontSize: "0.65rem" }}>{l.storageRoot ? sh(l.storageRoot, 6) : "—"}</div>
                </div>
                <div style={{ padding: "5px 8px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", fontSize: "0.7rem" }}>
                  <div style={{ color: "var(--text-3)", fontSize: "0.6rem", textTransform: "uppercase" }}>Created</div>
                  <div style={{ color: "var(--text-1)" }}>{fmtDate(l.createdAt)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {l.seller.toLowerCase() === (userWallet || "").toLowerCase() ? (
                  <Btn variant="secondary" onClick={() => doDelist(l.tokenId)} disabled={acting !== null} style={{ flex: 1, fontSize: "0.75rem" }}>
                    {acting === `delist-${l.tokenId}` ? "Delisting..." : "Delist"}
                  </Btn>
                ) : (
                  <Btn onClick={() => doBuy(l.tokenId)} disabled={acting !== null} style={{ flex: 1, fontSize: "0.75rem" }}>
                    {acting === `buy-${l.tokenId}` ? "Buying..." : `Buy for ${l.price} 0G`}
                  </Btn>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════
   PRIVACY
   ══════════════════════════════════════════════ */
function PrivacyTab() {
  const layers = [
    {
      title: "Encrypted Agent Config",
      status: "AES-256-GCM",
      desc: "System prompts are encrypted with AES-256-GCM before being stored on-chain. The encryption key is derived from the owner's private key + agent token ID. Plaintext never touches the blockchain — only the owner can decrypt their agent's personality.",
      detail: "Key derivation: SHA-256(privateKey + ':agent:' + tokenId) → 256-bit key. Format: base64(IV‖AuthTag‖Ciphertext). 12-byte IV, 16-byte auth tag, authenticated encryption.",
      variant: "green" as const,
    },
    {
      title: "TEE-Verified Inference",
      status: "Sealed Inference",
      desc: "All agent inference runs inside a Trusted Execution Environment (TEE) via 0G Compute. The model processes prompts inside a hardware enclave — neither the compute provider nor any third party can observe the input or output.",
      detail: "0G Compute broker negotiates TEE attestation. Each response includes a verifiable Chat ID. The broker's processResponse() validates the TEE signature chain. Proof cards shown on every message.",
      variant: "blue" as const,
    },
    {
      title: "On-Chain Access Control",
      status: "ownerOf()",
      desc: "Smart contracts enforce that only the INFT owner can update memory roots, clone agents, or modify config. The ownerOf() check is on-chain and immutable — no admin backdoor, no server override.",
      detail: "MindVaultINFT.updateMemory() → require(ownerOf(tokenId) == msg.sender). MemoryRegistry.recordSnapshot() → require(writers[agentId] == msg.sender). Clone requires ownership of the original.",
      variant: "amber" as const,
    },
    {
      title: "Merkle-Verified Storage",
      status: "0G Storage",
      desc: "Memories are serialized as JSON, Merkle-treed, and uploaded to 0G's decentralized storage network. The root hash is stored on-chain. Anyone can verify data integrity by downloading and recomputing the Merkle root.",
      detail: "Upload: JSON → TextEncoder → MemData → merkleTree() → indexer.upload(). Verify: download by rootHash → parse JSON → compare memory count. Tamper-evident by construction.",
      variant: "default" as const,
    },
    {
      title: "Memory Privacy Boundary",
      status: "Owner-Only",
      desc: "Memory content is stored on 0G Storage (content-addressed, not publicly indexed). The storage root hash is on-chain, but accessing the actual memory data requires knowing the root hash. Only the INFT owner's UI loads and displays memories.",
      detail: "Storage roots are public (on-chain), but memory content requires an explicit download call with the root hash. Future: encrypt memory payloads with owner key for full confidentiality.",
      variant: "green" as const,
    },
  ];

  return (
    <div className="fade-in">
      <Card style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: "var(--radius)", background: "linear-gradient(135deg, #7c3aed, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-0)" }}>Privacy & Security Model</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: 3, lineHeight: 1.5 }}>Five layers of privacy protection — from encrypted configs to TEE-verified inference to on-chain access control.</div>
        </div>
        <Badge variant="blue">5 Layers</Badge>
      </Card>

      {/* Privacy flow diagram */}
      <SectionLabel>Data Privacy Flow</SectionLabel>
      <Card style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr 28px 1fr 28px 1fr", alignItems: "center", textAlign: "center", fontSize: "0.75rem" }}>
          {[
            { label: "Plaintext Config", sub: "Browser only", bg: "var(--bg-2)" },
            null,
            { label: "AES-256-GCM", sub: "Encrypt before tx", bg: "var(--accent-dim)", border: "var(--accent-border)" },
            null,
            { label: "On-Chain", sub: "Ciphertext only", bg: "var(--bg-2)" },
            null,
            { label: "TEE Enclave", sub: "Sealed inference", bg: "var(--blue-dim)", border: "rgba(96,165,250,0.15)" },
          ].map((item, i) => item ? (
            <div key={i} style={{ padding: 12, background: item.bg, borderRadius: "var(--radius)", border: `1px solid ${item.border || "var(--border)"}` }}>
              <div style={{ fontWeight: 600, color: "var(--text-0)", fontSize: "0.75rem" }}>{item.label}</div>
              <div style={{ color: "var(--text-3)", marginTop: 2, fontSize: "0.65rem" }}>{item.sub}</div>
            </div>
          ) : (
            <div key={i} style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>→</div>
          ))}
        </div>
      </Card>

      <SectionLabel>Security Layers</SectionLabel>
      <div style={{ display: "grid", gap: 12 }}>
        {layers.map((layer, i) => (
          <Card key={i} className="slide-up" style={{ animationDelay: `${i * 60}ms`, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-0)" }}>{layer.title}</span>
              <Badge variant={layer.variant}>{layer.status}</Badge>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-2)", lineHeight: 1.6, marginBottom: 8 }}>{layer.desc}</div>
            <div style={{ padding: "8px 10px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", fontFamily: "var(--mono)", fontSize: "0.68rem", color: "var(--text-3)", lineHeight: 1.6 }}>{layer.detail}</div>
          </Card>
        ))}
      </div>

      <SectionLabel>Threat Model</SectionLabel>
      <Card>
        <div style={{ display: "grid", gap: 8 }}>
          {[
            { threat: "Compute provider reads prompts/responses", mitigation: "TEE enclave — provider cannot observe plaintext inside the enclave", status: "Mitigated" },
            { threat: "On-chain observer reads agent personality", mitigation: "AES-256-GCM encryption — ciphertext only on-chain", status: "Mitigated" },
            { threat: "Unauthorized memory update", mitigation: "ownerOf() check in smart contract — only token owner can write", status: "Mitigated" },
            { threat: "Memory data tampering in storage", mitigation: "Merkle proof verification — any modification changes the root hash", status: "Mitigated" },
            { threat: "Memory content visible via storage root", mitigation: "Root hash is public, content requires explicit download. Future: encrypted payloads", status: "Partial" },
          ].map((t, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, padding: "8px 10px", background: "var(--bg-2)", borderRadius: "var(--radius-sm)", fontSize: "0.75rem", alignItems: "center" }}>
              <div style={{ color: "var(--text-1)" }}>{t.threat}</div>
              <div style={{ color: "var(--text-2)" }}>{t.mitigation}</div>
              <Badge variant={t.status === "Mitigated" ? "green" : "amber"}>{t.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}


/* ══════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════ */
export default function Home() {
  const [tab, setTab] = useState<"dashboard" | "chat" | "marketplace" | "openclaw" | "privacy" | "arch">("dashboard");
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [balance, setBalance] = useState("0");
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(true);
  const [minting, setMinting] = useState(false);
  const [mintStep, setMintStep] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [network, setNetwork] = useState<string>(DEFAULT_NETWORK);
  const net = NETWORKS[network];

  const addToast = useCallback((msg: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents?network=${network}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAgents(data.agents || []); setBalance(data.balance || "0"); setWallet(data.wallet || "");
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setLoading(false); }
  }, [addToast, network]);

  useEffect(() => { load(); }, [load]);

  const doConnect = async () => {
    setConnecting(true);
    try {
      const { address } = await connectWallet();
      setUserWallet(address);
      addToast(`Connected: ${address.slice(0, 6)}…${address.slice(-4)}`, "success");
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "Connect failed", "error"); }
    finally { setConnecting(false); }
  };

  const mint = async (name: string, prompt: string) => {
    setMinting(true);
    try {
      if (userWallet) {
        setMintStep("Encrypting agent config with AES-256-GCM...");
        await new Promise(r => setTimeout(r, 300));
        setMintStep("Waiting for wallet signature...");
        const result = await mintAgentWithWallet(name, prompt);
        setMintStep("Confirming on 0G Chain...");
        addToast(`Agent minted via your wallet — Token #${result.tokenId}`, "success");
      } else {
        setMintStep("Encrypting agent config with AES-256-GCM...");
        await new Promise(r => setTimeout(r, 300));
        setMintStep("Submitting transaction to 0G Chain...");
        const res = await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, systemPrompt: prompt, network }) });
        setMintStep("Waiting for on-chain confirmation...");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setMintStep("Agent minted successfully!");
        addToast(`Agent minted (server wallet) — Token #${data.tokenId}`, "success");
      }
      await new Promise(r => setTimeout(r, 500));
      load();
    } catch (e: unknown) { addToast(e instanceof Error ? e.message : "Mint failed", "error"); }
    finally { setMinting(false); setMintStep(null); }
  };

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard" },
    { id: "chat" as const, label: "Chat" },
    { id: "marketplace" as const, label: "Marketplace" },
    { id: "openclaw" as const, label: "OpenClaw" },
    { id: "privacy" as const, label: "Privacy" },
    { id: "arch" as const, label: "Architecture" },
  ];

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "0 20px" }}>
      <Toasts toasts={toasts} />

      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NeuralOrb />
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-0)", letterSpacing: "-0.03em" }}>MindVault</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 500 }}>Persistent Memory for AI Agents</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select value={network} onChange={e => setNetwork(e.target.value)}
            style={{ padding: "4px 8px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text-0)", fontSize: "0.75rem", outline: "none", fontFamily: "var(--sans)" }}>
            {Object.values(NETWORKS).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <Badge variant="green"><Dot /> Live</Badge>
          {userWallet ? (
            <Badge variant="green"><Dot /> {userWallet.slice(0, 6)}…{userWallet.slice(-4)}</Badge>
          ) : hasWallet() ? (
            <Btn variant="secondary" onClick={doConnect} disabled={connecting} style={{ padding: "4px 12px", fontSize: "0.75rem" }}>
              {connecting ? "Connecting…" : "Connect Wallet"}
            </Btn>
          ) : null}
        </div>
      </header>

      {/* Nav */}
      <nav style={{ display: "flex", gap: 1, padding: "8px 0", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "6px 14px", borderRadius: "var(--radius-sm)", border: "none",
            fontSize: "0.8rem", fontWeight: 500, cursor: "pointer",
            background: tab === t.id ? "var(--accent-dim)" : "transparent",
            color: tab === t.id ? "var(--accent)" : "var(--text-2)",
            transition: "all 0.15s ease", fontFamily: "var(--sans)",
          }}>{t.label}</button>
        ))}
      </nav>

      {loading && tab === "dashboard" ? (
        <div style={{ textAlign: "center", padding: 80, color: "var(--text-3)" }}>
          <div className="typing-dots" style={{ marginBottom: 10 }}><span /><span /><span /></div>
          <div style={{ fontSize: "0.8rem" }}>Loading from 0G Chain…</div>
        </div>
      ) : (
        <>
          {tab === "dashboard" && <DashboardTab agents={agents} balance={balance} wallet={wallet} onRefresh={load} onMint={mint} minting={minting} mintStep={mintStep} addToast={addToast} userWallet={userWallet} network={network} net={net} />}
          {tab === "chat" && <ChatTab agents={agents} addToast={addToast} network={network} net={net} />}
          {tab === "marketplace" && <MarketplaceTab agents={agents} addToast={addToast} userWallet={userWallet} onRefresh={load} />}
          {tab === "openclaw" && <OpenClawTab />}
          {tab === "privacy" && <PrivacyTab />}
          {tab === "arch" && <ArchTab />}
        </>
      )}

      <footer style={{ textAlign: "center", padding: "24px 0", borderTop: "1px solid var(--border)", marginTop: 24 }}>
        <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
          Built for the 0G APAC Hackathon · 0G Storage · 0G Compute · 0G Chain · OpenClaw
        </div>
      </footer>
    </div>
  );
}
