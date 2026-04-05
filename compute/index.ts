import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

export interface InferenceResult {
  content: string;
  model: string;
  verified: boolean;
  chatId?: string;
}

async function getBroker() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  return createZGComputeNetworkBroker(wallet);
}

/// List available inference services on 0G Compute
export async function listServices() {
  const broker = await getBroker();
  const services = await broker.inference.listService();
  return services.map((s: any) => ({
    provider: s.provider,
    model: s.model,
    type: s.serviceType,
    inputPrice: s.inputPrice,
    outputPrice: s.outputPrice,
  }));
}

/// Run inference through 0G Compute with TEE verification
export async function infer(
  providerAddress: string,
  messages: { role: string; content: string }[]
): Promise<InferenceResult> {
  const broker = await getBroker();

  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
  const headers = await broker.inference.getRequestHeaders(providerAddress);

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ messages, model }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  const chatId = response.headers.get("ZG-Res-Key") || data.id;

  // Verify TEE signature
  let verified = false;
  if (chatId) {
    try {
      verified = await broker.inference.processResponse(providerAddress, chatId);
    } catch {
      verified = false;
    }
  }

  return { content, model, verified, chatId };
}
