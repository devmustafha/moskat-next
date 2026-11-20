import "server-only";
import { RtcRole, RtcTokenBuilder } from "agora-token";

/**
 * Agora RTC tokens (AccessToken2), built only on the server with the App Certificate.
 * `agora-token` uses Node's crypto and zlib, so anything importing this runs on the Node.js runtime.
 *
 * AGORA_APP_ID is returned to signed-in participants with their token (the Web SDK needs it).
 * AGORA_APP_CERTIFICATE never leaves the server: it is only read here, and has no NEXT_PUBLIC_ prefix.
 * Tokens are never logged.
 */

export class AgoraNotConfiguredError extends Error {
  constructor() {
    super("Video calls not configured (AGORA_APP_ID / AGORA_APP_CERTIFICATE are not set)");
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
