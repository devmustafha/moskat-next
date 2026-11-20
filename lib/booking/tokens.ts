/**
 * Booking references and private manage-link tokens (Web Crypto).
 */

// No 0/O/1/I/L, so references are easy to read over the phone.
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Short human-friendly code, e.g. "MSK-7F3K9Q". Unique by database constraint, not secret. */
export function createReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes, (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]).join("");
  return `MSK-${code}`;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 32 random bytes, URL-safe. Sent to the patient; only its hash is stored. */
export function createManageToken() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** SHA-256 of a manage token, hex-encoded. */
export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Cheap shape check before hashing, so junk URLs don't reach the database. */
export function isWellFormedToken(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
