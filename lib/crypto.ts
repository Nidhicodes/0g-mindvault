/**
 * Simple AES-256-GCM encryption for agent configs.
 * Key derived from the owner's private key + agent token ID.
 */
import * as crypto from "crypto";

const ALGO = "aes-256-gcm";

export function deriveKey(privateKey: string, agentId: number): Buffer {
  return crypto.createHash("sha256").update(`${privateKey}:agent:${agentId}`).digest();
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(encoded: string, key: Buffer): string {
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
