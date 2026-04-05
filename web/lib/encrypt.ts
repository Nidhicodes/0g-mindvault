import * as crypto from "crypto";

const ALGO = "aes-256-gcm";

export function encryptConfig(plaintext: string, privateKey: string, agentId: number): string {
  const key = crypto.createHash("sha256").update(`${privateKey}:agent:${agentId}`).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptConfig(encoded: string, privateKey: string, agentId: number): string {
  const key = crypto.createHash("sha256").update(`${privateKey}:agent:${agentId}`).digest();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
