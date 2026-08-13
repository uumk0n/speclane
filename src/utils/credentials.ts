import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".speclane");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.enc");

const SCRYPT_KEYLEN = 32;
const IV_LENGTH = 16;

/**
 * Derives a symmetric key from a passphrase. Same approach as secsync:
 * scrypt is deliberately slow to resist brute-force on a stolen file.
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, SCRYPT_KEYLEN);
}

export function saveApiKey(apiKey: string, passphrase: string): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });

  const salt = randomBytes(16);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // layout: salt(16) | iv(16) | authTag(16) | ciphertext
  const payload = Buffer.concat([salt, iv, authTag, encrypted]);
  writeFileSync(CREDENTIALS_PATH, payload, { mode: 0o600 });
}

export function loadApiKey(passphrase: string): string {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error("No stored API key found. Run `speclane init` first.");
  }

  const payload = readFileSync(CREDENTIALS_PATH);
  const salt = payload.subarray(0, 16);
  const iv = payload.subarray(16, 32);
  const authTag = payload.subarray(32, 48);
  const ciphertext = payload.subarray(48);

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

export function hasStoredApiKey(): boolean {
  return existsSync(CREDENTIALS_PATH);
}
