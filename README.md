# 🧠 MindVault — Persistent Memory & Identity for AI Agents on 0G

> AI agents that remember everything, prove every thought, and own their identity.

MindVault is a decentralized agent memory and identity platform built on 0G. AI agents store persistent memories on **0G Storage** (Merkle-verified), run inference through **0G Compute** (TEE-verified), and own their identity as **INFTs (ERC-7857)** on **0G Chain** — transferable, clonable, and truly owned.

**Track:** Agentic Infrastructure & OpenClaw Lab (Track 1)

## The Problem

Today's AI agents are stateless. Every session starts from zero — no memory of past conversations, no learning from experience, no proof of reasoning. When you "own" an AI agent, you don't really own anything. The intelligence lives on someone else's server, and the memories vanish when the session ends.

## The Solution

MindVault gives AI agents three things they've never had:

1. **Persistent Memory** — Memories extracted from conversations, stored on 0G Storage with Merkle proofs, and restored across sessions
2. **Verifiable Reasoning** — Every inference runs through 0G Compute with TEE (Sealed Inference) verification
3. **Tokenized Identity** — Each agent is an ERC-7857 INFT on 0G Chain — mintable, clonable, transferable, with encrypted config stored on-chain
4. **Cross-Agent Memory Sharing** — Agents can import memories from other agents, enabling composable intelligence
5. **OpenClaw Plugin** — 3 tools + hooks that let any OpenClaw gateway use MindVault for persistent memory

## Why This Matters — Market & Vision

### The Market

The AI agent market is projected to reach $47B by 2030. Every major framework (LangChain, AutoGPT, CrewAI) treats memory as an afterthought — in-process, ephemeral, unverifiable. As agents move from toys to production (trading, customer service, personal assistants), three problems become critical:

1. **Memory loss** — Agents forget everything between sessions. Users repeat themselves. Context is lost.
2. **Trust deficit** — No way to prove what an agent said or why. Black-box reasoning can't be audited.
3. **No ownership** — You can't transfer, sell, or compose agent intelligence. It's locked in a platform.

### Who Needs This

- **Agent framework developers** — Integrate MindVault via OpenClaw plugin to add persistent memory to any agent without building storage infrastructure
- **DeFi/trading teams** — Agents that remember market patterns across sessions, with TEE-verified reasoning for audit trails
- **AI-native dApps** — Personal assistants, tutors, companions that build long-term relationships with users
- **Agent marketplace builders** — INFTs enable a secondary market for trained agents — buy an agent that already knows your domain

### Competitive Landscape

| Approach | Memory | Verifiable | Owned | Decentralized |
|----------|--------|-----------|-------|---------------|
| ChatGPT Memory | ✓ | ✗ | ✗ | ✗ |
| LangChain + Pinecone | ✓ | ✗ | ✗ | ✗ |
| Mem0 | ✓ | ✗ | ✗ | ✗ |
| **MindVault on 0G** | **✓** | **✓ (TEE)** | **✓ (INFT)** | **✓** |

MindVault is the only solution that combines persistent memory, verifiable inference, tokenized ownership, and decentralized storage in a single stack — all on 0G.

### Growth Path

- **Phase 1 (now)**: Core infrastructure — memory persistence, verifiable inference, agent identity, OpenClaw plugin
- **Phase 2**: Agent marketplace — trade trained INFTs, memory licensing, cross-platform agent portability
- **Phase 3**: Agent economy — agents that hire other agents, pay for compute with earned revenue, autonomous organizations with verifiable decision trails

### Imagine This

- A **customer support agent** that remembers every interaction across 10,000 sessions. When an employee leaves, the company transfers the INFT to their replacement — institutional knowledge preserved, verified, owned.
- An **agent marketplace** where you buy a "Senior Solidity Auditor" INFT with 500 verified memories of past audits. The memory history is on-chain — you can verify what it knows before you buy.
- A **gaming NPC** with persistent memory that evolves based on player interactions. It remembers alliances, betrayals, and promises — and the game studio can prove the NPC's reasoning was TEE-verified, not scripted.
- A **DeFi trading agent** that accumulates market pattern memories over months. Its INFT becomes more valuable as its verified memory history grows — a new asset class.
- An **AI tutor** that remembers a student's learning style, weak areas, and progress across semesters. The student owns the INFT and can export their agent to any platform.


## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    MindVault Explorer (Next.js)               │
│    Dashboard · Chat · Memory Viewer · OpenClaw · Architecture │
└──────────┬────────────────────────────────┬──────────────────┘
           │  API Routes                    │
    ┌──────▼──────────────┐      ┌─────────▼──────────────────┐
    │   Agent Runtime     │      │   INFT Manager (ERC-7857)  │
    │   chat → extract    │      │   mint · clone · transfer  │
    │   persist → restore │      │   encrypted config on-chain│
    │   share memories    │      │   memory root tracking     │
    └──────┬──────┬───────┘      └─────────┬──────────────────┘
           │      │                        │
    ┌──────▼──┐ ┌─▼──────────┐   ┌────────▼──────────────────┐
    │0G Store │ │0G Compute  │   │0G Chain                   │
    │ Merkle  │ │ TEE Verify │   │ MindVaultINFT (ERC-7857)  │
    │ Proofs  │ │ Sealed Inf │   │ MemoryRegistry            │
    │ JSON    │ │ Qwen/DS V3 │   │ Snapshot history          │
    └─────────┘ └────────────┘   └────────────────────────────┘

    OpenClaw Plugin Layer:
    ├─ mindvault_store_memory  → 0G Storage + Chain update
    ├─ mindvault_recall_memory → Chain lookup + 0G Storage download
    ├─ mindvault_get_agent     → Chain INFT metadata read
    └─ agent_end hook          → Auto-checkpoint on session end
```

## 0G Integration Proof

This project integrates **4 core 0G components**:

| Component | How It's Used | Verification |
|-----------|--------------|--------------|
| **0G Storage** | Agent memories serialized as JSON, uploaded via `@0gfoundation/0g-ts-sdk` with Merkle proofs. Root hash stored on-chain. Supports upload, download, restore, and cross-agent sharing. | [StorageScan](https://storagescan-galileo.0g.ai) — search by root hash |
| **0G Compute** | All agent inference via `@0glabs/0g-serving-broker`. TEE-verified (Sealed Inference). Models: Qwen 2.5 7B, DeepSeek V3. On-chain billing. Two-pass memory extraction uses a second inference call for structured JSON extraction. | TEE verification badge on every chat message |
| **0G Chain** | Two Solidity contracts deployed: `MindVaultINFT` (ERC-7857 agent identity) and `MemoryRegistry` (snapshot history). Supports mint, clone, memory update, snapshot recording. | [ChainScan](https://chainscan-galileo.0g.ai) — contract addresses below |
| **Agent ID (INFT)** | Each agent is an ERC-7857 Intelligent NFT with encrypted config (AES-256-GCM). Supports cloning (inherits personality, fresh memory). Transferable ownership of AI intelligence. | `ownerOf()`, `getAgent()`, `cloneAgent()` on-chain |

### Contract Addresses

| Contract | Network | Address |
|----------|---------|---------|
| MindVaultINFT | 0G Mainnet | `0xcfee7588d1C396fa76d1D7f6f2BBC50153775785` |
| MemoryRegistry | 0G Mainnet | `0xd0565f93f450494e8373dE7f33d565E0B5b41089` |

> **Explorer links:**
> - INFT: https://chainscan.0g.ai/address/0xcfee7588d1C396fa76d1D7f6f2BBC50153775785
> - Registry: https://chainscan.0g.ai/address/0xd0565f93f450494e8373dE7f33d565E0B5b41089

Testnet contracts are also deployed at the same addresses on 0G Testnet (chain ID 16602).

## Key Features

### Two-Pass Memory Extraction
Unlike simple keyword parsing, MindVault uses a two-pass approach:
- **Pass 1**: Normal chat response with `[MEMORY]:` tag extraction
- **Pass 2**: If Pass 1 finds nothing, a second 0G Compute inference call extracts structured JSON memories from the conversation

This makes memory extraction reliable regardless of model output format.

### Cross-Session Memory Persistence
Agents remember across sessions. The "Restore from 0G" button in the chat sidebar loads an agent's existing memories from 0G Storage (via the on-chain Merkle root) into the current session.

### Cross-Agent Memory Sharing
Agent B can import Agent A's memories. The UI provides an "Import from…" dropdown that reads the source agent's storage root from the INFT contract, downloads memories from 0G Storage, and injects them into the current session.

### Sealed Inference Proof Cards
Every chat message shows a verification proof card with the Chat ID, TEE verification status, model used, and latency. This maps directly to 0G's Sealed Inference feature.

### Memory Verification
A "Verify Proof" button downloads memories from 0G Storage using the root hash, confirms the data is intact, and reports the memory count — proving the Merkle proof chain is valid.

### Agent Cloning (ERC-7857)
Clone an agent on-chain. The new INFT inherits the original's encrypted personality config but starts with fresh memory — demonstrating composable agent identity.

### Memory Timeline
Visual timeline showing how an agent's knowledge grows over time, with snapshot timestamps, memory counts, and storage roots.

### OpenClaw Plugin
3 registered tools (`mindvault_store_memory`, `mindvault_recall_memory`, `mindvault_get_agent`) + `agent_end` session hook. Any OpenClaw gateway can use MindVault for persistent memory without modification.


## Quick Start

### Prerequisites
- Node.js >= 22
- A wallet with 0G tokens ([faucet](https://faucet.0g.ai/))

### Setup

```bash
git clone https://github.com/sqnidhi/0g-mindvault
cd 0g-mindvault
npm install
cp .env.example .env
# Edit .env — add your PRIVATE_KEY
```

### Deploy Contracts (or use existing testnet addresses)

```bash
npx hardhat compile
npx tsx scripts/deploy.ts
# Copy output addresses to .env
```

The testnet contracts are already deployed and functional. You can use the addresses in `.env.example` to skip deployment.

### Run the CLI Demo

```bash
# Interactive mode — mint agent, chat, persist memories
npm run demo

# Scripted mode — automated demo for recording
npm run demo:scripted
```

### Run the Web UI

```bash
npm run dev
# Open http://localhost:3000
```

### Test Individual Components

```bash
# Test 0G Storage integration
npm run test:storage

# Test 0G Compute integration
npm run test:compute

# Test OpenClaw plugin end-to-end
npm run test:openclaw
```

### Architecture Note: Wallet Model
The web UI supports both modes:
- **Connected wallet (MetaMask)** — On-chain operations (mint, clone) go through the user's browser wallet. The user truly owns their agent INFTs. A "Connect Wallet" button in the header auto-adds the 0G network to MetaMask.
- **Server wallet (fallback)** — If no wallet is connected, on-chain operations use the server-side key for a frictionless demo experience. Storage uploads and compute inference always use the server wallet (0G SDKs are Node.js only).

The smart contracts enforce ownership via `ownerOf` checks — regardless of which wallet mints, only the owner can update memory or clone.


- The web UI connects to 0G testnet by default. All on-chain operations are real.
- Chat requires an active 0G Compute provider. If none are available, the demo falls back to storage-only mode.
- The "Restore from 0G" button in the chat sidebar demonstrates cross-session persistence.
- The "Import from…" dropdown demonstrates cross-agent memory sharing.
- The "Verify Proof" button after persisting demonstrates Merkle proof verification.
- Agent cloning is available on each agent card in the Dashboard tab.
- The Architecture tab shows live 0G Compute service discovery.

## Project Structure

```
├── contracts/src/
│   ├── MindVaultINFT.sol        # ERC-7857 agent identity NFT
│   └── MemoryRegistry.sol       # On-chain memory snapshot index
├── agent/
│   ├── index.ts                 # Core runtime: chat, extract, persist, restore
│   └── demo.ts                  # Interactive + scripted CLI demo
├── compute/
│   └── index.ts                 # 0G Compute inference with TEE verification
├── storage/
│   └── index.ts                 # 0G Storage upload/download with Merkle proofs
├── lib/
│   └── crypto.ts                # AES-256-GCM encryption for agent configs
├── openclaw/
│   ├── plugin.ts                # OpenClaw plugin: 3 tools + hooks
│   └── test.ts                  # End-to-end plugin test
├── web/
│   ├── app/page.tsx             # Dashboard, Chat, OpenClaw, Architecture tabs
│   └── app/api/                 # REST API: agents, chat, memory, verify, services
├── scripts/
│   └── deploy.ts                # Contract deployment script
├── openclaw.json                # OpenClaw gateway configuration
└── hardhat.config.ts            # 0G testnet + mainnet network config
```

## Tech Stack

- **Smart Contracts**: Solidity 0.8.28, Hardhat, OpenZeppelin (ERC721, Ownable)
- **Agent Runtime**: TypeScript, Node.js, ethers.js v6
- **0G Storage**: `@0gfoundation/0g-ts-sdk` — Merkle proofs, upload/download
- **0G Compute**: `@0glabs/0g-serving-broker` — TEE-verified inference, service discovery
- **Frontend**: Next.js 14, React 18, CSS custom properties (no Tailwind dependency)
- **Encryption**: AES-256-GCM for on-chain agent config
- **Chain**: 0G Testnet (16602) / Mainnet (16661)

## Team

- **sqnidhi** — Solo full-stack developer

## License

MIT

---

Built for the [0G APAC Hackathon 2026](https://www.hackquest.io/hackathons/0G-APAC-Hackathon)

#0GHackathon #BuildOn0G
