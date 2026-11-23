"use client";

import AgoraRTC, {
  type ConnectionState,
  type IAgoraRTCClient,
  type ICameraVideoTrack,
  type ILocalTrack,
  type IMicrophoneAudioTrack,
  type IRemoteAudioTrack,
  type IRemoteVideoTrack,
} from "agora-rtc-sdk-ng";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConsultationRole } from "@/lib/consultation/access";
import {
  base64ToBytes,
  CALL_ERROR_CODES,
  type CallErrorCode,
  type CallStatus,
  describeCallEnded,
  describeDeviceProblem,
  describeEndProblem,
  describeDisconnect,
  describeJoinError,
  describeTokenProblem,
  DECRYPTION_PROBLEM,
  type ProblemText,
  type SignalLevel,
  signalLevel,
  TOKEN_ERROR_CODES,
  type TokenGrant,
  type TokenProblem,
} from "@/lib/consultation/call-ui";
import type { AttendanceEvent } from "@/lib/consultation/lifecycle";
import { siteConfig } from "@/lib/site";

/**
 * One participant's side of a consultation video call, on the Agora Web SDK (4.x).
 *
 * Lifecycle: preparing (start camera and microphone) → lobby (preview, pick devices) → joining
 * (token from our server, then Agora) → in-call → left (they can rejoin) or over (they can't).
 *
 * - Tokens come from POST /api/consultations/<id>/token, which re-checks access every time. The
 *   call renews on `token-privilege-will-expire` (renewToken) and, if the token expired anyway,
 *   rejoins with a fresh one on `token-privilege-did-expire`, as Agora's token docs describe.
 * - Camera and microphone start separately, so a camera problem still allows an audio call.
 *   Microphone mute uses setMuted and camera off uses setEnabled (which turns the camera light
 *   off); Agora says never to mix the two on one track.
 * - Leaving, a dropped call, closing the tab (pagehide) or unmounting closes both tracks and
 *   leaves the channel, so the camera never stays on.
 * - Attendance: "joined" is reported once Agora has let us in, "left" whenever we leave the channel
 *   (fetch with keepalive, so it still goes out while the tab closes). The server uses it to start
 *   the call (both present → in progress) and to close it fairly.
 * - While in the call, GET …/status is polled (and asked at once when the other person leaves), so
 *   when the doctor ends the consultation for both, the patient's screen closes the call too.
 *   The doctor's "End for both" is POST …/end, allowed once the call has started.
 * - Media is encrypted with Agora's built-in encryption (aes-256-gcm2): the token response carries
 *   the call's secret and salt, set before every join. The SDK turns encryption off when leaving,
 *   so the token-expiry rejoin sets it again.
 * - Effects are guarded by a generation counter, so React's dev double-mount doesn't leak tracks.
 */

export type CallPhase = "unsupported" | "preparing" | "lobby" | "joining" | "in-call" | "left" | "over";

export type Peer = {
  /** In the channel now. */
  present: boolean;
  video: boolean;
  audio: boolean;
  /** Agora lost them (no packets for 20 s); they may come back. */
  dropped: boolean;
  /** They left the call themselves. */
  left: boolean;
};

const NO_PEER: Peer = { present: false, video: false, audio: false, dropped: false, left: false };
const UNKNOWN_SIGNAL = signalLevel({ uplinkNetworkQuality: 0, downlinkNetworkQuality: 0 });

type TokenResult = { ok: true; grant: TokenGrant } | { ok: false; problem: TokenProblem; opensAt?: Date };

async function requestToken(bookingId: string): Promise<TokenResult> {
  try {
    const response = await fetch(`/api/consultations/${encodeURIComponent(bookingId)}/token`, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.ok && body && typeof body === "object" && "token" in body) return { ok: true, grant: body as TokenGrant };
    const { error, opensAt } = (body ?? {}) as { error?: string; opensAt?: string };
    const problem = TOKEN_ERROR_CODES.find((code) => code === error) ?? "unavailable";
    return { ok: false, problem, opensAt: opensAt ? new Date(opensAt) : undefined };
  } catch {
    return { ok: false, problem: "network" };
  }
}

/** Tell the server we joined or left. keepalive: it still goes out while the page is closing. */
async function postAttendance(bookingId: string, event: AttendanceEvent) {
  try {
    const response = await fetch(`/api/consultations/${encodeURIComponent(bookingId)}/attendance`, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchStatus(bookingId: string): Promise<CallStatus | null> {
  try {
    const response = await fetch(`/api/consultations/${encodeURIComponent(bookingId)}/status`, { cache: "no-store", credentials: "same-origin" });
    return response.ok ? ((await response.json()) as CallStatus) : null;
  } catch {
    return null;
  }
}

type EndResponse = { ok: true } | { ok: false; problem: CallErrorCode | "network" };

async function requestEnd(bookingId: string): Promise<EndResponse> {
  try {
    const response = await fetch(`/api/consultations/${encodeURIComponent(bookingId)}/end`, { method: "POST", cache: "no-store", credentials: "same-origin" });
    if (response.ok) return { ok: true };
    const error = ((await response.json().catch(() => null)) as { error?: string } | null)?.error;
    return { ok: false, problem: CALL_ERROR_CODES.find((code) => code === error) ?? "unavailable" };
  } catch {
    return { ok: false, problem: "network" };
  }
}

/** Turn on the call's media encryption. Must come before each client.join (Web SDK 4.7+ resets it on leave). */
function applyEncryption(client: IAgoraRTCClient, { encryption }: TokenGrant) {
  client.setEncryptionConfig(encryption.mode, encryption.secret, base64ToBytes(encryption.salt));
}

/** The AgoraRTCError code, if this is one. */
function codeOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : undefined;
}

function deviceIdOf(track: ILocalTrack | null) {
  return track?.getMediaStreamTrack().getSettings().deviceId;
}

type Options = { bookingId: string; role: ConsultationRole; timeZone: string };

export function useConsultationCall({ bookingId, role, timeZone }: Options) {
  const [phase, setPhase] = useState<CallPhase>("preparing");
  const [problem, setProblem] = useState<ProblemText | null>(null);
  /** A non-fatal in-call message (e.g. renewals are refused, so the call will close). */
  const [notice, setNotice] = useState<string | null>(null);
  const [grant, setGrant] = useState<TokenGrant | null>(null);

  const [mic, setMic] = useState<IMicrophoneAudioTrack | null>(null);
  const [cam, setCam] = useState<ICameraVideoTrack | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphoneId, setMicrophoneId] = useState<string | undefined>();
  const [cameraId, setCameraId] = useState<string | undefined>();

  const [peer, setPeer] = useState<Peer>(NO_PEER);
  const [connection, setConnection] = useState<ConnectionState>("DISCONNECTED");
  const [signal, setSignal] = useState<SignalLevel>(UNKNOWN_SIGNAL);
  const [soundBlocked, setSoundBlocked] = useState(false);
  /** Both participants have been in the call together (server's view): the doctor can end it. */
  const [started, setStarted] = useState(false);
  const [ending, setEnding] = useState(false);

  const gen = useRef(0);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const camOnRef = useRef(true);
  const facingRef = useRef<"user" | "environment">("user");
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const grantRef = useRef<TokenGrant | null>(null);
  const localEl = useRef<HTMLDivElement | null>(null);
  const remoteEl = useRef<HTMLDivElement | null>(null);
  const remoteVideo = useRef<IRemoteVideoTrack | null>(null);
  const remoteAudio = useRef<IRemoteAudioTrack | null>(null);
  const rejoining = useRef(false);
  /** We told the server we joined, so leaving the channel must tell it we left. */
  const reportedJoin = useRef(false);
  const checkStatusRef = useRef<() => void>(() => {});
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const tokenText = useCallback(
    (result: Extract<TokenResult, { ok: false }>) => describeTokenProblem(result.problem, { role, opensAt: result.opensAt, timeZone }),
    [role, timeZone],
  );

  // Local devices ------------------------------------------------------------------------------

  const refreshDevices = useCallback(async () => {
    try {
      // Labels are only filled in once permission was granted, which starting the tracks asked for.
      const devices = await AgoraRTC.getDevices(true);
      setMicrophones(devices.filter((d) => d.kind === "audioinput" && d.deviceId));
      setCameras(devices.filter((d) => d.kind === "videoinput" && d.deviceId));
      setMicrophoneId(deviceIdOf(micRef.current));
      setCameraId(deviceIdOf(camRef.current));
    } catch {
      // Device lists are a convenience; the default devices still work.
    }
  }, []);

  const startMicrophone = useCallback(async () => {
    const mine = gen.current;
    setMicError(null);
    try {
      const track = await AgoraRTC.createMicrophoneAudioTrack();
      if (gen.current !== mine) return track.close();
      micRef.current?.close();
      micRef.current = track;
      setMic(track);
      setMicMuted(false);
    } catch (error) {
      if (gen.current === mine) setMicError(describeDeviceProblem(codeOf(error), "microphone"));
    }
  }, []);

  const startCamera = useCallback(async () => {
    const mine = gen.current;
    setCamError(null);
    try {
      // 480p keeps mobile data use and cost down (Agora's default profile, 640 × 480, 15 fps).
      const track = await AgoraRTC.createCameraVideoTrack({ encoderConfig: "480p_1" });
      if (gen.current !== mine) return track.close();
      camRef.current?.close();
      camRef.current = track;
      camOnRef.current = true;
      facingRef.current = "user";
      setCam(track);
      setCamOn(true);
      setFacing("user");
    } catch (error) {
      if (gen.current === mine) setCamError(describeDeviceProblem(codeOf(error), "camera"));
    }
  }, []);

  const closeLocal = useCallback(() => {
    micRef.current?.close();
    camRef.current?.close();
    micRef.current = null;
    camRef.current = null;
    setMic(null);
    setCam(null);
  }, []);

  const prepare = useCallback(async () => {
    const mine = gen.current;
    setPhase("preparing");
    // One after the other, so browsers ask for each permission in turn.
    await startMicrophone();
    await startCamera();
    await refreshDevices();
    if (gen.current === mine) setPhase("lobby");
  }, [refreshDevices, startCamera, startMicrophone]);

  // The channel --------------------------------------------------------------------------------

  const releaseWakeLock = useCallback(() => {
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  /** Leave the channel and forget the client. Safe to call twice. */
  const dropClient = useCallback(async () => {
    const client = clientRef.current;
    clientRef.current = null;
    grantRef.current = null;
    remoteVideo.current = null;
    remoteAudio.current = null;
    setPeer(NO_PEER);
    setConnection("DISCONNECTED");
    setSignal(UNKNOWN_SIGNAL);
    setStarted(false);
    if (!client) return;
    if (reportedJoin.current) {
      reportedJoin.current = false;
      void postAttendance(bookingId, "left");
    }
    client.removeAllListeners();
    await client.leave().catch(() => {});
  }, [bookingId]);

  /** End this participant's call: leave, turn the camera and microphone off, show `next`. */
  const finish = useCallback(
    async (next: "left" | "over", text: ProblemText | null = null) => {
      setProblem(text);
      setNotice(null);
      setPhase(next);
      releaseWakeLock();
      closeLocal();
      await dropClient();
    },
    [closeLocal, dropClient, releaseWakeLock],
  );

  /** After Agora let us in (first join or rejoin): tell the server, then see whether the call has started. */
  const reportJoined = useCallback(
    async (client: IAgoraRTCClient) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (clientRef.current !== client) return;
        if (await postAttendance(bookingId, "joined")) {
          // Left while the report was on its way: undo it, so we don't stay "present".
          if (clientRef.current !== client) return void postAttendance(bookingId, "left");
          reportedJoin.current = true;
          return checkStatusRef.current();
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    },
    [bookingId],
  );

  /** Ask the server whether the call has started and whether it has ended (then leave). */
  const checkStatus = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    const status = await fetchStatus(bookingId);
    if (!status || clientRef.current !== client) return;
    setStarted(status.started);
    if (status.ended) await finish("over", describeCallEnded(role, status.endedBy));
  }, [bookingId, finish, role]);

  useEffect(() => {
    checkStatusRef.current = () => void checkStatus();
  }, [checkStatus]);

  /** The doctor's "End for both": the server closes the call and completes the booking. */
  const endForBoth = useCallback(async () => {
    if (role !== "doctor" || !clientRef.current) return;
    setEnding(true);
    setNotice(null);
    const result = await requestEnd(bookingId);
    setEnding(false);
    if (result.ok) return void (await finish("over", describeCallEnded("doctor", "doctor")));
    setNotice(describeEndProblem(result.problem));
    if (result.problem === "ended" || result.problem === "not_active") checkStatusRef.current();
  }, [bookingId, finish, role]);

  const publishLocal = useCallback(async (client: IAgoraRTCClient) => {
    // A disabled track can't be published (TRACK_IS_DISABLED); the camera is published when turned on.
    const tracks: ILocalTrack[] = [];
    if (micRef.current) tracks.push(micRef.current);
    if (camRef.current && camOnRef.current) tracks.push(camRef.current);
    if (tracks.length > 0) await client.publish(tracks);
  }, []);

  const renew = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    const result = await requestToken(bookingId);
    if (clientRef.current !== client) return;
    if (result.ok) {
      grantRef.current = result.grant;
      await client.renewToken(result.grant.token).catch(() => {});
      return;
    }
    const text = tokenText(result);
    if (text.retry) {
      // A transient failure: the token has 30 s left, so try once more shortly.
      setTimeout(() => {
        if (clientRef.current === client) void renew();
      }, 10_000);
    } else {
      setNotice(`${text.message} The call will close shortly.`);
    }
  }, [bookingId, tokenText]);

  const rejoin = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    rejoining.current = true;
    try {
      const result = await requestToken(bookingId);
      if (clientRef.current !== client) return;
      if (!result.ok) {
        const text = tokenText(result);
        return void (await finish(text.retry ? "left" : "over", text));
      }
      const { appId, channel, token, uid } = result.grant;
      if (client.connectionState !== "DISCONNECTED") await client.leave();
      applyEncryption(client, result.grant);
      await client.join(appId, channel, token, uid);
      grantRef.current = result.grant;
      await publishLocal(client);
      void reportJoined(client);
    } catch (error) {
      if (clientRef.current === client) await finish("left", describeJoinError(codeOf(error)));
    } finally {
      rejoining.current = false;
    }
  }, [bookingId, finish, publishLocal, reportJoined, tokenText]);

  const listen = useCallback(
    (client: IAgoraRTCClient, peerUid: number) => {
      client.on("user-joined", (user) => {
        if (user.uid !== peerUid) return;
        setPeer((p) => ({ ...p, present: true, dropped: false, left: false }));
        // Their "joined" report reaches the server just after Agora tells us; then the call has started.
        setTimeout(() => checkStatusRef.current(), 3000);
      });
      client.on("user-published", async (user, mediaType) => {
        if (user.uid !== peerUid || mediaType === "datachannel") return;
        try {
          await client.subscribe(user, mediaType);
        } catch {
          return;
        }
        if (clientRef.current !== client) return;
        if (mediaType === "video" && user.videoTrack) {
          remoteVideo.current = user.videoTrack;
          // "contain": show the whole picture, so nothing the doctor needs to see is cropped.
          if (remoteEl.current) user.videoTrack.play(remoteEl.current, { fit: "contain" });
          setPeer((p) => ({ ...p, present: true, video: true }));
        }
        if (mediaType === "audio" && user.audioTrack) {
          remoteAudio.current = user.audioTrack;
          user.audioTrack.play();
          setPeer((p) => ({ ...p, present: true, audio: true }));
        }
      });
      client.on("user-unpublished", (user, mediaType) => {
        if (user.uid !== peerUid) return;
        if (mediaType === "video") {
          remoteVideo.current = null;
          setPeer((p) => ({ ...p, video: false }));
        } else if (mediaType === "audio") {
          remoteAudio.current = null;
          setPeer((p) => ({ ...p, audio: false }));
        }
      });
      client.on("user-left", (user, reason) => {
        if (user.uid !== peerUid) return;
        remoteVideo.current = null;
        remoteAudio.current = null;
        setPeer({ ...NO_PEER, dropped: reason === "ServerTimeOut", left: reason !== "ServerTimeOut" });
        // They may have ended the consultation for both (the doctor's button), not just left.
        if (reason !== "ServerTimeOut") checkStatusRef.current();
      });
      client.on("connection-state-change", (current, _previous, reason) => {
        if (clientRef.current !== client) return;
        setConnection(current);
        if (current !== "DISCONNECTED" || rejoining.current) return;
        const text = describeDisconnect(reason);
        if (text) void finish(text.retry ? "left" : "over", text);
      });
      client.on("network-quality", (stats) => setSignal(signalLevel(stats)));
      // Their page uses other encryption settings (e.g. an old copy of the page): we'd see nothing.
      client.on("crypt-error", () => setNotice(DECRYPTION_PROBLEM));
      client.on("token-privilege-will-expire", () => void renew());
      client.on("token-privilege-did-expire", () => void rejoin());
    },
    [finish, rejoin, renew],
  );

  const join = useCallback(async () => {
    if (clientRef.current) return;
    const mine = gen.current;
    setProblem(null);
    setNotice(null);
    setPhase("joining");

    const result = await requestToken(bookingId);
    if (gen.current !== mine) return;
    if (!result.ok) {
      const text = tokenText(result);
      setProblem(text);
      if (text.retry) return setPhase("lobby");
      return void (await finish("over", text));
    }

    const { appId, channel, token, uid, peerUid } = result.grant;
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    clientRef.current = client;
    grantRef.current = result.grant;
    setGrant(result.grant);
    listen(client, peerUid);
    try {
      applyEncryption(client, result.grant);
      await client.join(appId, channel, token, uid);
      if (gen.current !== mine || clientRef.current !== client) return void (await client.leave().catch(() => {}));
      await publishLocal(client);
      setPhase("in-call");
      void reportJoined(client);
    } catch (error) {
      if (clientRef.current !== client) return;
      await dropClient();
      setProblem(describeJoinError(codeOf(error)));
      setPhase("lobby");
    }
  }, [bookingId, dropClient, finish, listen, publishLocal, reportJoined, tokenText]);

  const leave = useCallback(() => finish("left"), [finish]);

  // Controls -----------------------------------------------------------------------------------

  const toggleMic = useCallback(async () => {
    const track = micRef.current;
    if (!track) return;
    const next = !track.muted;
    await track.setMuted(next).catch(() => {});
    setMicMuted(track.muted);
  }, []);

  const toggleCamera = useCallback(async () => {
    const track = camRef.current;
    if (!track) return;
    const next = !camOnRef.current;
    try {
      await track.setEnabled(next);
    } catch {
      return;
    }
    camOnRef.current = next;
    setCamOn(next);
    const client = clientRef.current;
    if (next) {
      if (localEl.current) track.play(localEl.current, { mirror: facingRef.current === "user" });
      if (client?.connectionState === "CONNECTED" && !client.localTracks.includes(track)) await client.publish(track).catch(() => {});
    }
  }, []);

  const selectMicrophone = useCallback(async (deviceId: string) => {
    await micRef.current?.setDevice(deviceId).catch(() => {});
    setMicrophoneId(deviceIdOf(micRef.current) ?? deviceId);
  }, []);

  const selectCamera = useCallback(async (deviceId: string) => {
    await camRef.current?.setDevice(deviceId).catch(() => {});
    setCameraId(deviceIdOf(camRef.current) ?? deviceId);
  }, []);

  /** Front ↔ back camera on phones (setDevice with facingMode, Web SDK 4.19+). */
  const flipCamera = useCallback(async () => {
    const track = camRef.current;
    if (!track) return;
    const next = facingRef.current === "user" ? "environment" : "user";
    try {
      await track.setDevice({ facingMode: next });
    } catch {
      return;
    }
    facingRef.current = next;
    setFacing(next);
    setCameraId(deviceIdOf(track));
    if (localEl.current) track.play(localEl.current, { mirror: next === "user" });
  }, []);

  /** After a tap: browsers allow sound once the person has interacted with the page. */
  const resumeSound = useCallback(() => {
    remoteAudio.current?.play();
    setSoundBlocked(false);
  }, []);

  // Where the videos play: callback refs, so a newly mounted box (lobby → call) gets the video.

  const localVideoRef = useCallback(
    (el: HTMLDivElement | null) => {
      localEl.current = el;
      if (el && cam) cam.play(el, { mirror: facingRef.current === "user" });
    },
    [cam],
  );

  const remoteVideoRef = useCallback((el: HTMLDivElement | null) => {
    remoteEl.current = el;
    if (el && remoteVideo.current) remoteVideo.current.play(el, { fit: "contain" });
  }, []);

  // Effects ------------------------------------------------------------------------------------

  // Mount: check the browser, start the devices; unmount: leave and turn everything off.
  useEffect(() => {
    const mine = ++gen.current;
    if (!AgoraRTC.checkSystemRequirements()) {
      setPhase("unsupported");
      return;
    }
    AgoraRTC.setLogLevel(process.env.NODE_ENV === "production" ? 3 : 1); // 3: errors only
    AgoraRTC.disableLogUpload();
    AgoraRTC.onAutoplayFailed = () => setSoundBlocked(true);
    AgoraRTC.onMicrophoneChanged = async (info) => {
      await refreshDevices();
      // The microphone in use was unplugged: switch to another one if there is one.
      if (info.state === "INACTIVE" && micRef.current && deviceIdOf(micRef.current) === info.device.deviceId) {
        const other = (await AgoraRTC.getMicrophones(true).catch(() => [])).find((d) => d.deviceId && d.deviceId !== info.device.deviceId);
        if (other) await micRef.current.setDevice(other.deviceId).catch(() => {});
        await refreshDevices();
      }
    };
    AgoraRTC.onCameraChanged = async (info) => {
      await refreshDevices();
      if (info.state === "INACTIVE" && camRef.current && deviceIdOf(camRef.current) === info.device.deviceId) {
        const other = (await AgoraRTC.getCameras(true).catch(() => [])).find((d) => d.deviceId && d.deviceId !== info.device.deviceId);
        if (other) await camRef.current.setDevice(other.deviceId).catch(() => {});
        await refreshDevices();
      }
    };
    void prepare();

    return () => {
      if (gen.current === mine) gen.current++;
      AgoraRTC.onAutoplayFailed = undefined;
      AgoraRTC.onMicrophoneChanged = undefined;
      AgoraRTC.onCameraChanged = undefined;
      releaseWakeLock();
      closeLocal();
      void dropClient();
    };
  }, [closeLocal, dropClient, prepare, refreshDevices, releaseWakeLock]);

  // Closing the tab or navigating away leaves the call (Agora would otherwise notice after ~20 s).
  useEffect(() => {
    const onPageHide = () => {
      if (clientRef.current || micRef.current || camRef.current) void finish("left");
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [finish]);

  // Keep the screen awake during the call (where supported), re-acquiring it after the tab is shown again.
  useEffect(() => {
    if (phase !== "in-call" || !("wakeLock" in navigator)) return;
    const acquire = () => {
      if (document.visibilityState !== "visible" || wakeLock.current) return;
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          wakeLock.current = sentinel;
          sentinel.addEventListener("release", () => {
            if (wakeLock.current === sentinel) wakeLock.current = null;
          });
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      releaseWakeLock();
    };
  }, [phase, releaseWakeLock]);

  // While in the call: has it started (the doctor can end it for both), and has it been ended?
  useEffect(() => {
    if (phase !== "in-call") return;
    const timer = setInterval(() => void checkStatus(), siteConfig.consultation.statusPollSeconds * 1000);
    return () => clearInterval(timer);
  }, [checkStatus, phase]);

  // The hard stop (end + grace): leave, as the server would refuse further tokens anyway.
  useEffect(() => {
    if (phase !== "in-call" || !grant) return;
    const ms = new Date(grant.call.hardStopAt).getTime() - Date.now();
    const timer = setTimeout(
      () => void finish("over", { message: "The time for this video call is over.", retry: false }),
      Math.max(0, Math.min(ms, 2 ** 31 - 1)),
    );
    return () => clearTimeout(timer);
  }, [finish, grant, phase]);

  return {
    phase,
    problem,
    notice,
    grant,
    local: { mic, cam, micError, camError, micMuted, camOn, facing, microphones, cameras, microphoneId, cameraId },
    peer,
    connection,
    signal,
    soundBlocked,
    started,
    ending,
    localVideoRef,
    remoteVideoRef,
    actions: {
      join,
      leave,
      endForBoth,
      rejoin: prepare,
      toggleMic,
      toggleCamera,
      selectMicrophone,
      selectCamera,
      flipCamera,
      resumeSound,
      retryMicrophone: async () => {
        await startMicrophone();
        await refreshDevices();
      },
      retryCamera: async () => {
        await startCamera();
        await refreshDevices();
      },
    },
  };
}

export type ConsultationCall = ReturnType<typeof useConsultationCall>;
