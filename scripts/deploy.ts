import { ethers } from "ethers";
import * as fs from "fs";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL || "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

async function deployContract(wallet: ethers.Wallet, name: string, artifactPath: string) {
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`✅ ${name} deployed: ${address}`);
  return address;
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} 0G\n`);

  if (balance === 0n) {
    console.log("❌ No balance! Get tokens from https://faucet.0g.ai/");
    return;
  }

  const inftAddr = await deployContract(
    wallet,
    "MindVaultINFT",
    "./artifacts/contracts/src/MindVaultINFT.sol/MindVaultINFT.json"
  );

  const registryAddr = await deployContract(
    wallet,
    "MemoryRegistry",
    "./artifacts/contracts/src/MemoryRegistry.sol/MemoryRegistry.json"
  );

  console.log(`\n📋 Add to .env:`);
  console.log(`INFT_CONTRACT_ADDRESS=${inftAddr}`);
  console.log(`MEMORY_REGISTRY_ADDRESS=${registryAddr}`);
  const isMainnet = RPC_URL.includes("evmrpc.0g.ai") && !RPC_URL.includes("testnet");
  const explorer = isMainnet ? "https://chainscan.0g.ai" : "https://chainscan-galileo.0g.ai";
  console.log(`\n🔍 Verify on explorer:`);
  console.log(`${explorer}/address/${inftAddr}`);
  console.log(`${explorer}/address/${registryAddr}`);
}

main().catch(console.error);
