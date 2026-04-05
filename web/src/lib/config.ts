import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";

export const zgTestnet = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: {
    default: { name: "ChainScan", url: "https://chainscan-galileo.0g.ai" },
  },
});

export const config = createConfig({
  chains: [zgTestnet],
  connectors: [injected()],
  transports: { [zgTestnet.id]: http() },
});

export const CONTRACTS = {
  inft: "0xcfee7588d1C396fa76d1D7f6f2BBC50153775785" as `0x${string}`,
  registry: "0xd0565f93f450494e8373dE7f33d565E0B5b41089" as `0x${string}`,
};
