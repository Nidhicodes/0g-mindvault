import { ethers } from "ethers";
import "dotenv/config";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log("Address:", wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "0G");
  console.log("Chain ID:", (await provider.getNetwork()).chainId.toString());
}
main().catch(console.error);
