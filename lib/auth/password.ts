import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing for Better Auth (`emailAndPassword.password`).
 *
 * scrypt N=16384, r=16, p=1 (32 MB), Better Auth's default. To strengthen it later, raise
 * `CURRENT` (never lower it): hashes carry their own parameters, so old ones keep verifying,
 * and `needsRehash` tells sign-in to replace them.
 *
 * The password is first HMAC'd with a pepper (a server secret, never in the database), so a
 * leaked database alone can't be cracked offline. Never change the pepper: every stored
 * password would stop verifying.
 *
 * Format: scrypt$<N>$<r>$<p>$<salt, base64url>$<key, base64url>
 * Uses node:crypto, so the app and the Node scripts share it.
 */

const CURRENT = { N: 16384, r: 16, p: 1 } as const;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAX_MEMORY = 64 * 1024 * 1024;

type Params = { N: number; r: number; p: number };

function derive(pepper: string, password: string, salt: Buffer, { N, r, p }: Params) {
  const peppered = createHmac("sha256", pepper).update(password.normalize("NFKC")).digest();
  return scryptSync(peppered, salt, KEY_LENGTH, { N, r, p, maxmem: MAX_MEMORY });
}

function parse(hash: string) {
  const parts = hash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  // Bounds stop a tampered hash from making verification arbitrarily expensive.
  if (![N, r, p].every(Number.isInteger) || N < 2 || N > 2 ** 17 || (N & (N - 1)) !== 0 || r < 1 || r > 32 || p < 1 || p > 4) {
    return null;
  }
  const salt = Buffer.from(parts[4], "base64url");
  const key = Buffer.from(parts[5], "base64url");
  if (salt.length < SALT_LENGTH || key.length !== KEY_LENGTH) return null;
  return { params: { N, r, p }, salt, key };
}

export function createPasswordHasher(pepper: string | undefined) {
  if (!pepper || pepper.length < 32) {
    throw new Error("PASSWORD_PEPPER must be set to at least 32 characters (see README: Authentication).");
  }

  return {
    async hash(password: string) {
      const salt = randomBytes(SALT_LENGTH);
      const key = derive(pepper, password, salt, CURRENT);
      return ["scrypt", CURRENT.N, CURRENT.r, CURRENT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
    },

    async verify({ hash, password }: { hash: string; password: string }) {
      const parsed = parse(hash);
      if (!parsed) return false;
      const key = derive(pepper, password, parsed.salt, parsed.params);
      return timingSafeEqual(key, parsed.key);
    },
  };
}

/** True when a stored hash uses weaker parameters than the current ones. */
export function needsRehash(hash: string) {
  const parsed = parse(hash);
  if (!parsed) return true;
  const { N, r, p } = parsed.params;
  return N < CURRENT.N || r < CURRENT.r || p < CURRENT.p;
}
