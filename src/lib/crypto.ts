/**
 * Real client-side encryption using WebCrypto.
 * - PBKDF2-SHA256 (250k iterations) → AES-GCM 256 key
 * - Per-file random salt (16 bytes) and IV (12 bytes)
 * - Output layout: [magic 4B "CSE1"][salt 16B][iv 12B][ciphertext+tag]
 *
 * The user's passphrase never leaves the browser. Only the ciphertext
 * is uploaded to storage.
 */

const MAGIC = new TextEncoder().encode("CSE1"); // CloudStore Encrypted v1
const PBKDF2_ITERATIONS = 250_000;

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBlob(blob: Blob, passphrase: string): Promise<Blob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = new Uint8Array(await blob.arrayBuffer());
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext as BufferSource)
  );
  const out = new Uint8Array(MAGIC.length + salt.length + iv.length + ciphertext.length);
  out.set(MAGIC, 0);
  out.set(salt, MAGIC.length);
  out.set(iv, MAGIC.length + salt.length);
  out.set(ciphertext, MAGIC.length + salt.length + iv.length);
  return new Blob([out], { type: "application/octet-stream" });
}

export async function decryptBlob(blob: Blob, passphrase: string): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf.length < MAGIC.length + 16 + 12) {
    throw new Error("File is not a valid encrypted CloudStore file.");
  }
  const magic = buf.slice(0, MAGIC.length);
  for (let i = 0; i < MAGIC.length; i++) {
    if (magic[i] !== MAGIC[i]) {
      throw new Error("File is not a valid encrypted CloudStore file.");
    }
  }
  const salt = buf.slice(MAGIC.length, MAGIC.length + 16);
  const iv = buf.slice(MAGIC.length + 16, MAGIC.length + 16 + 12);
  const ciphertext = buf.slice(MAGIC.length + 16 + 12);
  const key = await deriveKey(passphrase, salt);
  try {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new Blob([plaintext]);
  } catch {
    throw new Error("Wrong passphrase or corrupted file.");
  }
}
