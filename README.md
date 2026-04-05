# 🧠 MindVault — Persistent Memory & Identity for AI Agents on 0G

> AI agents that remember everything, prove every thought, and own their identity.

MindVault is a decentralized agent memory and identity platform where AI agents store persistent memories on **0G Storage**, run verifiable inference via **0G Compute**, and own their identity as **INFTs (ERC-7857)** on **0G Chain**.

## The Problem

Today's AI agents are stateless. Every session starts from zero. They can't remember past conversations, learn from experience, or prove their reasoning. And when you "own" an AI agent, you don't really own anything — the intelligence lives on someone else's server.

## The Solution

MindVault gives AI agents:

1. **Persistent Memory** — Memories stored as KV pairs on 0G Storage, surviving across sessions
2. **Verifiable Reasoning** — Every inference runs through 0G Compute with TEE verification proofs
3. **Tokenized Identity** — Each agent is an INFT (ERC-7857) on 0G Chain — transferable, clonable, truly owned
4. **Memory Explorer** — Visual dashboard to inspect agent memories, verify inference proofs, and manage agent NFTs

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                 │
│         Agent Dashboard / Memory Explorer            │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌───────▼────────────┐
    │   Agent Runtime     │  │   INFT Manager     │
    │   (TypeScript)      │  │   (ERC-7857)       │
    └──────┬──────┬───────┘  └───────┬─────────────┘
           │      │                  │
    ┌──────▼──┐ ┌─▼──────────┐ ┌────▼─────────────┐
    │0G Store │ │0G Compute  │ │0G Chain           │
    │ KV+Files│ │ Inference  │ │ INFT + Registry   │
    │         │ │ TEE Verify │ │ chainscan.0g.ai   │
    └─────────┘ └────────────┘ └────────────────────┘
```

## 0G Integration

| Component | Usage | Proof |
|-----------|-------|-------|
| **0G Storage** | Agent memories persisted as JSON via TS SDK. Merkle root stored on-chain. | StorageScan link |
| **0G Compute** | All agent inference via DeepSeek/Qwen with TEE verification | Verified response IDs |
| **0G Chain** | INFT contract (ERC-7857) + MemoryRegistry contract deployed on mainnet | ChainScan link |
| **Agent ID (INFT)** | Each agent minted as ERC-7857 token with encrypted metadata | Contract address |

## Quick Start

### Prerequisites
- Node.js >= 22
- MetaMask with 0G network configured
- 0G tokens (testnet or mainnet)

### Setup

```bash
git clone https://github.com/YOUR_REPO/0g-mindvault
cd 0g-mindvault
npm install
cp .env.example .env
# Edit .env with your PRIVATE_KEY
```

### Deploy Contracts

```bash
npx hardhat run scripts/deploy.ts --network 0g-testnet
# Copy the output addresses to .env
```

### Test Storage Integration

```bash
npx tsx storage/test.ts
```

### Test Compute Integration

```bash
npx tsx compute/test.ts
```

### Run Agent

```bash
npx tsx agent/index.ts
```

### Launch Web UI

```bash
cd web && npm run dev
```

## Contract Addresses

| Contract | Network | Address |
|----------|---------|---------|
| MindVaultINFT | 0G Mainnet | `TBD` |
| MemoryRegistry | 0G Mainnet | `TBD` |

Explorer: https://chainscan.0g.ai

## Tech Stack

- **Frontend**: Next.js 14, Tailwind CSS, wagmi, viem
- **Agent Runtime**: TypeScript, Node.js
- **0G Storage**: `@0gfoundation/0g-ts-sdk`
- **0G Compute**: `@0glabs/0g-serving-broker`
- **Smart Contracts**: Solidity 0.8.24, Hardhat, OpenZeppelin
- **Chain**: 0G Mainnet (Chain ID 16661)

## Team

- **sqnidhi** — Full-stack developer

## License

MIT

---

Built for the [0G APAC Hackathon 2026](https://www.hackquest.io/hackathons/0G-APAC-Hackathon) 🏗️

#0GHackathon #BuildOn0G
