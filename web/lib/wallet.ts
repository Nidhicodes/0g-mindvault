/**
 * Lightweight wallet connect using window.ethereum + ethers.js BrowserProvider.
 * No wagmi/viem dependency — keeps the bundle small.
 */

import { INFT_ADDRESS, INFT_ABI, RPC_URL, CHAIN_ID } from "./contracts";

const ZG_CHAIN = {
  chainId: `0x${CHAIN_ID.toString(16)}`,
  chainName: CHAIN_ID === 16661 ? "0G Mainnet" : "0G Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: [CHAIN_ID === 16661 ? "https://chainscan.0g.ai" : "https://chainscan-galileo.0g.ai"],
};

export function hasWallet(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum;
}

export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  const eth = (window as unknown as { ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) throw new Error("No wallet detected. Install MetaMask.");

  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts[0]) throw new Error("No account selected");

  // Switch to 0G chain
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ZG_CHAIN.chainId }] });
  } catch (e: unknown) {
    const err = e as { code?: number };
    if (err.code === 4902) {
      await eth.request({ method: "wallet_addEthereumChain", params: [ZG_CHAIN] });
    } else {
      throw e;
    }
  }

  const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
  return { address: accounts[0], chainId: parseInt(chainHex, 16) };
}

export async function getWalletSigner() {
  const { ethers } = await import("ethers");
  const eth = (window as unknown as { ethereum: object }).ethereum;
  const provider = new ethers.BrowserProvider(eth as { request: (...args: unknown[]) => Promise<unknown> });
  return provider.getSigner();
}

export async function mintAgentWithWallet(name: string, encryptedConfig: string): Promise<{ tokenId: number; txHash: string }> {
  const { ethers } = await import("ethers");
  const signer = await getWalletSigner();
  const inft = new ethers.Contract(INFT_ADDRESS, INFT_ABI, signer);

  const tx = await inft.mintAgent(name, encryptedConfig);
  const receipt = await tx.wait();

  const iface = new ethers.Interface(["event AgentMinted(uint256 indexed tokenId, address indexed owner, string name)"]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "AgentMinted") {
        return { tokenId: Number(parsed.args.tokenId), txHash: receipt.hash };
      }
    } catch { /* skip */ }
  }
  throw new Error("Mint succeeded but couldn't parse event");
}

export async function cloneAgentWithWallet(tokenId: number): Promise<{ cloneId: number; txHash: string }> {
  const { ethers } = await import("ethers");
  const signer = await getWalletSigner();
  const inft = new ethers.Contract(INFT_ADDRESS, INFT_ABI, signer);

  const tx = await inft.cloneAgent(tokenId);
  const receipt = await tx.wait();

  const iface = new ethers.Interface(["event AgentCloned(uint256 indexed originalId, uint256 indexed cloneId, address indexed newOwner)"]);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === "AgentCloned") {
        return { cloneId: Number(parsed.args.cloneId), txHash: receipt.hash };
      }
    } catch { /* skip */ }
  }
  throw new Error("Clone succeeded but couldn't parse event");
}
