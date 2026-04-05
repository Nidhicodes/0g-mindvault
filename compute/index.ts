import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
import "dotenv/config";

const RPC_URL = process.env.RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;

export interface InferenceResult {
  content: string;
  model: string;
  verified: boolean;
  chatId?: string;
  latencyMs: number;
}

let _broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;

async function getBroker() {
  if (!_broker) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    _broker = await createZGComputeNetworkBroker(wallet);
  }
  return _broker;
}

export async function listServices() {
  const broker = await getBroker();
  const services = await broker.inference.listService();
  return services.map((s: Record<string, unknown>) => ({
    provider: s.provider as string,
    model: s.model as string,
    type: s.serviceType as string,
    inputPrice: s.inputPrice,
    outputPrice: s.outputPrice,
  }));
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function infer(
  providerAddress: string,
  messages: { role: string; content: string }[]
): Promise<InferenceResult> {
  const start = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[Compute] Retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(RETRY_DELAY * attempt);
      }

      const broker = await getBroker();
      const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
      const headers = await broker.inference.getRequestHeaders(providerAddress);

      const response = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ messages, model }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Inference HTTP ${response.status}: ${await response.text().catch(() => "unknown")}`);
      }

      const data = await response.json();
      if (!data.choices?.[0]?.message?.content) {
        throw new Error("Empty response from model");
      }

      const content = data.choices[0].message.content;
      const chatId = response.headers.get("ZG-Res-Key") || data.id;

      let verified = false;
      if (chatId) {
        try {
          const result = await broker.inference.processResponse(providerAddress, chatId);
          verified = !!result;
        } catch { verified = false; }
      }

      return { content, model, verified, chatId, latencyMs: Date.now() - start };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt === MAX_RETRIES) break;
    }
  }

  throw new Error(`Inference failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
}
