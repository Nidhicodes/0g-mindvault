/**
 * Fund the 0G Compute sub-account for inference billing.
 * This creates a ledger account and deposits tokens so you can pay for inference.
 */
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const DEPOSIT_AMOUNT = "0.05";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} 0G`);
  console.log(`RPC: ${RPC_URL}\n`);

  if (balance === 0n) {
    console.log("No balance! Get tokens from https://faucet.0g.ai/");
    return;
  }

  console.log("Creating 0G Compute broker...");
  const broker = await createZGComputeNetworkBroker(wallet);

  // Step 1: Check if ledger account exists
  try {
    const ledger = await broker.ledger.getLedger();
    console.log("Ledger account exists:", JSON.stringify(ledger, (k, v) => typeof v === "bigint" ? v.toString() : v).slice(0, 200));
  } catch {
    console.log("No ledger account found. Creating one...");
    try {
      await broker.ledger.addLedger(0.05);
      console.log(`Ledger created with ${DEPOSIT_AMOUNT} 0G deposit.`);
    } catch (e: unknown) {
      const msg = (e as Error).message || "";
      if (msg.includes("already") || msg.includes("exists")) {
        console.log("Ledger already exists. Depositing funds...");
        await broker.ledger.depositFund(0.05);
        console.log(`Deposited ${DEPOSIT_AMOUNT} 0G.`);
      } else {
        console.log(`Create ledger failed: ${msg.slice(0, 200)}`);
        return;
      }
    }
  }

  // Step 2: List available services
  console.log("\nAvailable compute services:");
  const services = await broker.inference.listService();
  for (const s of services) {
    const svc = s as { provider: string; model: string; serviceType: string };
    console.log(`  ${svc.model} (${svc.serviceType}) — ${svc.provider.slice(0, 12)}...`);
  }
  if (services.length === 0) {
    console.log("  No services available right now.");
  }

  console.log("\nDone. You can now use 0G Compute for inference.");
}

main().catch(console.error);
