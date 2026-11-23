import "server-only";
import { RtcRole, RtcTokenBuilder } from "agora-token";
import { deriveMediaEncryption, MIN_MEDIA_SECRET_LENGTH } from "./media-key";

/**
 * Agora RTC tokens (AccessToken2), built only on the server with the App Certificate.
 * `agora-token` uses Node's crypto and zlib, so anything importing this runs on the Node.js runtime.
 *
 * AGORA_APP_ID is returned to signed-in participants with their token (the Web SDK needs it).
 * AGORA_APP_CERTIFICATE never leaves the server: it is only read here, and has no NEXT_PUBLIC_ prefix.
 * Tokens are never logged.
 */

export class AgoraNotConfiguredError extends Error {
  constructor(what = "AGORA_APP_ID / AGORA_APP_CERTIFICATE are not set") {
    super(`Video calls not configured (${what})`);
    this.name = "AgoraNotConfiguredError";
  }
}

function credentials() {
  const appId = process.env.AGORA_APP_ID?.trim();
  const appCertificate = process.env.AGORA_APP_CERTIFICATE?.trim();
  // Both are 32 hex characters in the Agora Console.
  if (!appId || !appCertificate || !/^[0-9a-f]{32}$/i.test(appId) || !/^[0-9a-f]{32}$/i.test(appCertificate)) {
    throw new AgoraNotConfiguredError();
  }
  return { appId, appCertificate };
}

/**
 * A publisher token for `uid` in `channel`, valid for `ttlSeconds`. Token and privilege expiry are
 * equal, as Agora recommends (docs: Deploy a token server → BuildTokenWithUid).
 */
export function buildRtcToken(channel: string, uid: number, ttlSeconds: number) {
  const { appId, appCertificate } = credentials();
  const token = RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channel, uid, RtcRole.PUBLISHER, ttlSeconds, ttlSeconds);
  return { appId, token };
}

/**
 * The call's media encryption settings (lib/consultation/media-key.ts), given to its two
 * participants with their token. Without CONSULTATION_MEDIA_SECRET no token is issued at all, so
 * a call never runs unencrypted by mistake. Never logged.
 */
export function mediaEncryptionFor(channel: string) {
  const secret = process.env.CONSULTATION_MEDIA_SECRET?.trim();
  if (!secret || secret.length < MIN_MEDIA_SECRET_LENGTH) throw new AgoraNotConfiguredError("CONSULTATION_MEDIA_SECRET is not set");
  return deriveMediaEncryption(secret, channel);
}
