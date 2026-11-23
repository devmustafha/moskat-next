import { createHmac } from "node:crypto";

/**
 * Agora built-in media encryption for video calls (docs: Secure channel encryption). Audio and
 * video are encrypted in the browser with a key Agora never sees, so its servers only relay
 * ciphertext. Both participants must use the same mode, secret and salt, and each call gets its
 * own: they are derived from CONSULTATION_MEDIA_SECRET and the call's random channel name, so
 * nothing extra is stored and a rejoin gets the same values.
 *
 * Kept apart from the App Certificate on purpose: Agora knows the certificate (it checks tokens),
 * so a key derived from it wouldn't be secret from Agora.
 */

/** 256-bit AES-GCM with a salt: the strongest mode the Web SDK offers (4.5.0+). */
export const MEDIA_ENCRYPTION_MODE = "aes-256-gcm2";

export type MediaEncryption = {
  mode: typeof MEDIA_ENCRYPTION_MODE;
  /** 32 random-looking bytes as base64 (44 ASCII characters: the SDK takes ASCII, at most 62). */
  secret: string;
  /** 32 bytes as base64; the browser decodes it to the Uint8Array the SDK takes. */
  salt: string;
};

/** The master secret must be long enough to be a real key (e.g. `openssl rand -base64 32`). */
export const MIN_MEDIA_SECRET_LENGTH = 32;

/** The encryption settings for one call. Deterministic per (master secret, channel name). */
export function deriveMediaEncryption(masterSecret: string, channelName: string): MediaEncryption {
  if (masterSecret.length < MIN_MEDIA_SECRET_LENGTH) throw new Error("The media encryption secret is too short");
  const derive = (purpose: "secret" | "salt") =>
    createHmac("sha256", masterSecret).update(`moskat:media-encryption:v1:${purpose}:${channelName}`).digest("base64");
  return { mode: MEDIA_ENCRYPTION_MODE, secret: derive("secret"), salt: derive("salt") };
}
