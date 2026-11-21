import { formatTime } from "@/lib/format";
import type { ConsultationRole } from "./access";

/**
 * Shared between the token endpoint and the call screen: the response shapes, and the words the
 * call screen shows for each outcome. Pure and client-safe (no secrets, no server imports).
 */

/** 200 from POST /api/consultations/<id>/token. */
export type TokenGrant = {
  appId: string;
  channel: string;
  uid: number;
  token: string;
  /** ISO time the token (and its privileges) expire. */
  expiresAt: string;
  role: ConsultationRole;
  peerUid: number;
  /** The other participant's name; the patient's is null once their details are purged. */
  peerName: string | null;
  call: { startsAt: string; endsAt: string; opensAt: string; hardStopAt: string; status: string };
};

/** `error` in the token endpoint's non-200 responses. */
export type TokenErrorCode =
  | "forbidden_origin"
  | "signed_out"
  | "not_found"
  | "rate_limited"
  | "not_paid"
  | "cancelled"
  | "ended"
  | "too_early"
  | "closed"
  | "unavailable";

export const TOKEN_ERROR_CODES: readonly TokenErrorCode[] = [
  "forbidden_origin",
  "signed_out",
  "not_found",
  "rate_limited",
  "not_paid",
  "cancelled",
  "ended",
  "too_early",
  "closed",
  "unavailable",
];

/** Why a token couldn't be had: the endpoint's error, or no response at all. */
export type TokenProblem = TokenErrorCode | "network";

export type ProblemText = {
  message: string;
  /** Trying again later can work (as opposed to: this call is over, or was never available). */
  retry: boolean;
};

export function describeTokenProblem(
  problem: TokenProblem,
  { role, opensAt, timeZone }: { role: ConsultationRole; opensAt?: Date; timeZone: string },
): ProblemText {
  switch (problem) {
    case "too_early":
      return {
        message: opensAt ? `The call opens at ${formatTime(opensAt, timeZone)}. You can join from then.` : "The call isn’t open yet.",
        retry: true,
      };
    case "rate_limited":
      return { message: "Too many attempts in a short time. Wait a minute, then try again.", retry: true };
    case "network":
      return { message: "We couldn’t reach Moskat. Check your internet connection, then try again.", retry: true };
    case "unavailable":
    case "forbidden_origin":
      return { message: "Video calls aren’t available right now. Try again in a moment.", retry: true };
    case "signed_out":
      return { message: "You’ve been signed out. Sign in again to join the call.", retry: false };
    case "not_found":
      return { message: "We couldn’t find this consultation.", retry: false };
    case "not_paid":
      return {
        message:
          role === "patient"
            ? "This booking isn’t paid, so the video call isn’t available."
            : "This booking hasn’t been paid, so the video call isn’t available.",
        retry: false,
      };
    case "cancelled":
      return { message: "This consultation was cancelled.", retry: false };
    case "ended":
      return { message: "This consultation has ended.", retry: false };
    case "closed":
      return { message: "The time for this video call has passed.", retry: false };
  }
}

/**
 * What to tell someone whose camera or microphone couldn't start. `code` is the AgoraRTCError
 * code (see AgoraRTCErrorCode in agora-rtc-sdk-ng's types), or undefined for anything else.
 */
export function describeDeviceProblem(code: string | undefined, device: "camera" | "microphone"): string {
  switch (code) {
    case "PERMISSION_DENIED":
      return `Your browser blocked the ${device}. Allow it for this site (usually the icon in the address bar), then try again.`;
    case "DEVICE_NOT_FOUND":
      return `We couldn’t find a ${device}. Connect one, then try again.`;
    case "NOT_READABLE":
      return `Your ${device} is in use by another app or tab. Close it there, then try again.`;
    case "CONSTRAINT_NOT_SATISFIED":
    case "MEDIA_OPTION_INVALID":
      return `Your ${device} doesn’t support the settings we need. Try another ${device}.`;
    case "NOT_SUPPORTED":
      return `This browser can’t use your ${device}. Try the latest Chrome, Safari, Edge or Firefox.`;
    default:
      return `Your ${device} couldn’t start. Try again, or reload the page.`;
  }
}

/** Agora's network quality, 0 (unknown) and 1 (excellent) to 6 (down), for the uplink and downlink. */
export type NetworkQualityStats = { uplinkNetworkQuality: number; downlinkNetworkQuality: number };

export type SignalLevel = { bars: 0 | 1 | 2 | 3; label: string };

/** Bars for the network indicator, from the worse of the two directions. */
export function signalLevel({ uplinkNetworkQuality: up, downlinkNetworkQuality: down }: NetworkQualityStats): SignalLevel {
  const known = [up, down].filter((q) => q > 0);
  if (known.length === 0) return { bars: 0, label: "Checking your connection" };
  const worst = Math.max(...known);
  if (worst <= 2) return { bars: 3, label: "Good connection" };
  if (worst === 3) return { bars: 2, label: "Fair connection" };
  if (worst <= 5) return { bars: 1, label: "Poor connection" };
  return { bars: 0, label: "No connection" };
}

/** "4:05" or "1:02:30" until `target`; "0:00" once it has passed. */
export function formatCountdown(target: Date, now: Date): string {
  const total = Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

/** What to show when joining the channel itself fails (after a token was issued). */
export function describeJoinError(code: string | undefined): ProblemText {
  switch (code) {
    case "UID_CONFLICT":
      return { message: "You’re already in this call in another tab or on another device. Leave there first, then try again.", retry: true };
    case "CAN_NOT_GET_GATEWAY_SERVER":
    case "NETWORK_ERROR":
    case "NETWORK_TIMEOUT":
    case "WS_ABORT":
      return { message: "We couldn’t connect to the video service. Check your internet connection, then try again.", retry: true };
    default:
      return { message: "We couldn’t start the call. Try again, or reload the page.", retry: true };
  }
}

/**
 * Why the call disconnected, from Agora's ConnectionDisconnectedReason; null when nothing should
 * be shown (we left ourselves, or the token expired and the call is rejoining with a new one).
 */
export function describeDisconnect(reason: string | undefined): ProblemText | null {
  switch (reason) {
    case undefined:
    case "LEAVE":
    case "TOKEN_EXPIRE":
      return null;
    case "UID_CONFLICT":
      return { message: "You joined this call from another tab or device, so it ended here.", retry: true };
    case "UID_BANNED":
    case "IP_BANNED":
    case "CHANNEL_BANNED":
      return { message: "You’ve been removed from this call.", retry: false };
    default:
      if (reason.startsWith("LICENSE_")) return { message: "Video calls aren’t available right now. Try again in a moment.", retry: true };
      return { message: "You lost your connection to the call.", retry: true };
  }
}
