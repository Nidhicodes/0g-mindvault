import { NextResponse } from "next/server";
import { ethers } from "ethers";

const RPC = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const PK = process.env.PRIVATE_KEY || "";
const INFT = process.env.INFT_CONTRACT_ADDRESS || "";
const MARKET = process.env.MARKETPLACE_ADDRESS || "";

const INFT_ABI = [
  "function getAgent(uint256) view returns (string name, string storageRoot, string kvStreamId, string encryptedConfig, uint256 createdAt, uint256 updatedAt)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function approve(address to, uint256 tokenId)",
  "function getApproved(uint256 tokenId) view returns (address)",
];

const MARKET_ABI = [
  "function list(uint256 tokenId, uint256 price)",
  "function delist(uint256 tokenId)",
  "function buy(uint256 tokenId) payable",
  "function getListing(uint256 tokenId) view returns (address seller, uint256 price)",
  "function listedCount() view returns (uint256)",
  "function listedTokenIds(uint256 index) view returns (uint256)",
];

function getProvider() { return new ethers.JsonRpcProvider(RPC); }
function getSigner() { return new ethers.Wallet(PK, getProvider()); }

// GET — fetch all active listings
export async function GET() {
  if (!MARKET) return NextResponse.json({ listings: [], enabled: false });
  try {
    const provider = getProvider();
    const market = new ethers.Contract(MARKET, MARKET_ABI, provider);
    const inft = new ethers.Contract(INFT, INFT_ABI, provider);
    const count = Number(await market.listedCount());

    const listings = [];
    for (let i = 0; i < count; i++) {
      try {
        const tokenId = Number(await market.listedTokenIds(i));
        const [seller, price] = await market.getListing(tokenId);
        if (seller === ethers.ZeroAddress) continue; // delisted
        const agent = await inft.getAgent(tokenId);
        listings.push({
          tokenId,
          seller,
          price: ethers.formatEther(price),
          priceWei: price.toString(),
          name: agent.name,
          storageRoot: agent.storageRoot,
          createdAt: Number(agent.createdAt),
        });
      } catch { /* skip invalid */ }
    }

    return NextResponse.json({ listings, enabled: true, marketplace: MARKET });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

// POST — list, delist, or buy
export async function POST(req: Request) {
  if (!MARKET) return NextResponse.json({ error: "Marketplace not deployed" }, { status: 400 });
  try {
    const { action, tokenId, price } = await req.json();
    const signer = getSigner();
    const market = new ethers.Contract(MARKET, MARKET_ABI, signer);
    const inft = new ethers.Contract(INFT, INFT_ABI, signer);

    if (action === "list") {
      const priceWei = ethers.parseEther(String(price));
      // Approve marketplace to transfer the INFT
      const approved = await inft.getApproved(tokenId);
      if (approved !== MARKET) {
        const approveTx = await inft.approve(MARKET, tokenId);
        await approveTx.wait();
      }
      const tx = await market.list(tokenId, priceWei);
      const receipt = await tx.wait();
      return NextResponse.json({ txHash: receipt.hash, tokenId, price });
    }

    if (action === "delist") {
      const tx = await market.delist(tokenId);
      const receipt = await tx.wait();
      return NextResponse.json({ txHash: receipt.hash, tokenId });
    }

    if (action === "buy") {
      const [, listPrice] = await market.getListing(tokenId);
      const tx = await market.buy(tokenId, { value: listPrice });
      const receipt = await tx.wait();
      return NextResponse.json({ txHash: receipt.hash, tokenId });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
