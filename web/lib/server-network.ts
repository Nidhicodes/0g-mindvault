import { ethers } from "ethers";
import { getNetwork, type NetworkConfig } from "./networks";

const PK = process.env.PRIVATE_KEY || "";

export function resolveNetwork(networkId?: string): NetworkConfig & { provider: ethers.JsonRpcProvider; signer: ethers.Wallet } {
  const net = getNetwork(networkId);
  const provider = new ethers.JsonRpcProvider(net.rpcUrl);
  const signer = new ethers.Wallet(PK, provider);
  return { ...net, provider, signer };
}

export function getNetworkFromRequest(url: string): string {
  const u = new URL(url);
  return u.searchParams.get("network") || "mainnet";
}
