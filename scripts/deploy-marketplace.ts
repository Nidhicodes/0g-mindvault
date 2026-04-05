import { ethers } from "ethers";
import * as fs from "fs";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const INFT_ADDRESS = process.env.INFT_CONTRACT_ADDRESS!;

async function main() {
  if (!INFT_ADDRESS) {
    console.log("INFT_CONTRACT_ADDRESS not set in .env");
    return;
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} 0G`);
  console.log(`INFT: ${INFT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}\n`);

  if (balance === 0n) {
    console.log("No balance! Get tokens from https://faucet.0g.ai/");
    return;
  }

  const artifact = JSON.parse(
    fs.readFileSync("./artifacts/contracts/src/AgentMarketplace.sol/AgentMarketplace.json", "utf-8")
  );

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Deploying AgentMarketplace...");
  const contract = await factory.deploy(INFT_ADDRESS);
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`\nAgentMarketplace deployed: ${address}`);
  const isMainnet = RPC_URL.includes("evmrpc.0g.ai") && !RPC_URL.includes("testnet");
  const explorer = isMainnet ? "https://chainscan.0g.ai" : "https://chainscan-galileo.0g.ai";
  console.log(`Explorer: ${explorer}/address/${address}`);
  console.log(`\nAdd to .env:\nMARKETPLACE_ADDRESS=${address}`);
}

main().catch(console.error);
