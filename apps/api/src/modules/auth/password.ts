import { hash, verify } from "@node-rs/argon2";

/**
 * Hashes a password with Argon2id using the library defaults (memory-hard, OWASP-recommended).
 * The output is a self-describing PHC string, so parameters can be raised later without a migration.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Verifies a password against a stored hash. Malformed hashes count as a mismatch, never an error. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
