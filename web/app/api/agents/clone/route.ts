import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { resolveNetwork } from "../../../../lib/server-network";

const ABI = [
  "function cloneAgent(uint256 originalId) returns (uint256)",
  "event AgentCloned(uint256 indexed originalId, uint256 indexed cloneId, address indexed newOwner)",
];

export async function POST(req: Request) {
  try {
    const { tokenId, network: networkId } = await req.json();
    const net = resolveNetwork(networkId);
    const inft = new ethers.Contract(net.inftAddress, ABI, net.signer);

    const tx = await inft.cloneAgent(tokenId);
    const receipt = await tx.wait();

    const iface = new ethers.Interface(["event AgentCloned(uint256 indexed originalId, uint256 indexed cloneId, address indexed newOwner)"]);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "AgentCloned") {
          return NextResponse.json({ cloneId: Number(parsed.args.cloneId), originalId: tokenId, txHash: receipt.hash });
        }
      } catch { /* skip */ }
    }
    return NextResponse.json({ error: "Clone succeeded but couldn't parse event" }, { status: 500 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Clone failed" }, { status: 500 });
  }
}
