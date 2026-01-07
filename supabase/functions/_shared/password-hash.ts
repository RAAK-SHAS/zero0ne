import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

// Use bcrypt for secure password hashing (cost factor 12)
const BCRYPT_COST = 12;

/**
 * Hash a password using bcrypt with secure settings
 * Returns the hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_COST);
  return await bcrypt.hash(password, salt);
}

/**
 * Verify a password against a stored bcrypt hash
 * Returns true if password matches
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, storedHash);
  } catch {
    return false;
  }
}

/**
 * Check if a hash is using the legacy SHA-256 format (64 hex characters)
 * Used for backwards compatibility during migration
 */
export function isLegacySha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/i.test(hash);
}

/**
 * Verify using legacy SHA-256 (for backwards compatibility only)
 * This should only be used for existing shares until they're updated
 */
export async function verifyLegacySha256(password: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}
