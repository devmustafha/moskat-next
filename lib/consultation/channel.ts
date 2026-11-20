/**
 * Agora channel names for video calls: 32 random hex characters (128 bits), one per booking,
 * never derived from the booking id. Agora allows up to 64 bytes from a small character set;
 * hex is well inside it.
 */
export function createChannelName() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isWellFormedChannelName(name: string) {
  return /^[0-9a-f]{32}$/.test(name);
}
