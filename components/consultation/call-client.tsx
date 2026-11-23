"use client";

import { CircleAlert, CircleStop, Clock, Mic, MicOff, PhoneOff, SwitchCamera, Video, VideoOff, Volume2, WifiOff } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ConsultationRole } from "@/lib/consultation/access";
import { formatCountdown } from "@/lib/consultation/call-ui";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ControlButton, DevicePicker, MicLevel, NetworkIndicator } from "./call-parts";
import { type ConsultationCall, useConsultationCall } from "./use-consultation-call";

export type CallClientProps = {
  bookingId: string;
  role: ConsultationRole;
  /** The other participant, as they should be named on screen. */
  peerName: string;
  timeZone: string;
  /** ISO times from the server (lib/consultation/access.ts consultationWindow). */
  startsAt: string;
  endsAt: string;
  opensAt: string;
  hardStopAt: string;
  backHref: string;
  backLabel: string;
};

/** Warn this long before the hard stop that the call is about to close. */
const CLOSING_WARNING_MS = 5 * 60_000;

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * The video call screen: lobby (preview and devices), the call itself (full screen), and what's
 * shown after leaving. Client-only: loaded with `ssr: false` by consultation-room.tsx, because the
 * Agora Web SDK needs the browser.
 */
export default function CallClient(props: CallClientProps) {
  const call = useConsultationCall({ bookingId: props.bookingId, role: props.role, timeZone: props.timeZone });
  const now = useNow();

  switch (call.phase) {
    case "unsupported":
      return (
        <Outcome title="This browser can’t make video calls" back={props}>
          Open this page in the latest Chrome, Safari, Edge or Firefox. On iPhone and iPad, use Safari.
        </Outcome>
      );
    case "in-call":
      return <CallStage call={call} now={now} {...props} />;
    case "left": {
      const canRejoin = (call.problem?.retry ?? true) && now < new Date(props.hardStopAt);
      return (
        <Outcome title={call.problem ? "You’re no longer in the call" : "You’ve left the call"} back={props} icon={call.problem ? WifiOff : undefined}>
          {call.problem?.message ?? "Your camera and microphone are off."}
          {canRejoin && (
            <span className="mt-6 block">
              <Button variant="brand" onClick={() => void call.actions.rejoin()}>
                Rejoin the call
              </Button>
            </span>
          )}
        </Outcome>
      );
    }
    case "over":
      return (
        <Outcome title="This video call is closed" back={props}>
          {call.problem?.message ?? "This consultation has ended."}
        </Outcome>
      );
    default:
      return <Lobby call={call} now={now} {...props} />;
  }
}

function Outcome({ title, children, back, icon: Icon = Clock }: { title: string; children: ReactNode; back: CallClientProps; icon?: typeof Clock }) {
  return (
    <Card tone="muted" className="mx-auto grid max-w-xl justify-items-start gap-4 md:p-10">
      <Icon aria-hidden="true" className="size-6 text-brand-700" strokeWidth={1.75} />
      <h2 className="text-h3">{title}</h2>
      <div role="status" className="text-small text-ink-muted">
        {children}
      </div>
      <Link href={back.backHref} className="link mt-2 text-small">
        {back.backLabel}
      </Link>
    </Card>
  );
}

function Notice({ tone = "info", icon: Icon = CircleAlert, children }: { tone?: "info" | "alert"; icon?: typeof CircleAlert; children: ReactNode }) {
  return (
    <p
      role={tone === "alert" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-field p-4 text-small", tone === "alert" ? "bg-alert-soft text-alert" : "bg-surface")}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </p>
  );
}

type ViewProps = CallClientProps & { call: ConsultationCall; now: Date };

function Lobby({ call, now, peerName, timeZone, startsAt, endsAt, opensAt, role }: ViewProps) {
  const ids = { mic: useId(), cam: useId() };
  const [coarsePointer] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const { local, phase, problem, actions } = call;
  const opens = new Date(opensAt);
  const open = now >= opens;
  const preparing = phase === "preparing";
  const joining = phase === "joining";
  const showVideo = local.cam && local.camOn;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)] lg:gap-12">
      <div className="grid content-start gap-3">
        <div className="relative aspect-video overflow-hidden rounded-card bg-ink text-white">
          <div ref={call.localVideoRef} className={cn("absolute inset-0", !showVideo && "invisible")} />
          {!showVideo && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-small text-white/80">
              {preparing ? "Starting your camera…" : local.camError ? "Camera unavailable" : "Your camera is off"}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-4 scrim">
            <ControlButton
              icon={local.micMuted ? MicOff : Mic}
              label={local.micMuted ? "Unmute microphone" : "Mute microphone"}
              pressed={local.micMuted}
              off={local.micMuted}
              disabled={!local.mic}
              onClick={() => void actions.toggleMic()}
            />
            <ControlButton
              icon={local.camOn ? Video : VideoOff}
              label={local.camOn ? "Turn camera off" : "Turn camera on"}
              pressed={!local.camOn}
              off={!local.camOn}
              disabled={!local.cam}
              onClick={() => void actions.toggleCamera()}
            />
            {coarsePointer && local.cameras.length > 1 && (
              <ControlButton icon={SwitchCamera} label="Switch camera" disabled={!local.cam || !local.camOn} onClick={() => void actions.flipCamera()} />
            )}
          </div>
        </div>
        <p className="flex items-center gap-3 text-caption text-ink-muted">
          <span>{local.mic ? (local.micMuted ? "Microphone muted" : "Microphone") : "No microphone"}</span>
          <MicLevel track={local.mic} muted={local.micMuted} />
        </p>
      </div>

      <div className="grid content-start gap-5">
        <div>
          <h2 className="text-h3">Ready to join?</h2>
          <p className="mt-2 text-small text-ink-muted">
            Your consultation with {peerName}, {formatTime(new Date(startsAt), timeZone)}–{formatTime(new Date(endsAt), timeZone)}.
          </p>
        </div>

        {local.micError && (
          <Notice tone="alert">
            {local.micError}{" "}
            <button type="button" className="link font-medium" onClick={() => void actions.retryMicrophone()}>
              Try again
            </button>
          </Notice>
        )}
        {local.camError && (
          <Notice tone={local.mic ? "info" : "alert"}>
            {local.camError} {local.mic && "You can still join with audio only. "}
            <button type="button" className="link font-medium" onClick={() => void actions.retryCamera()}>
              Try again
            </button>
          </Notice>
        )}
        {problem && <Notice tone="alert">{problem.message}</Notice>}

        <DevicePicker id={ids.mic} label="Microphone" devices={local.microphones} value={local.microphoneId} onChange={(id) => void actions.selectMicrophone(id)} disabled={!local.mic} />
        {!coarsePointer && (
          <DevicePicker id={ids.cam} label="Camera" devices={local.cameras} value={local.cameraId} onChange={(id) => void actions.selectCamera(id)} disabled={!local.cam} />
        )}

        <Button variant="brand" className="justify-between sm:w-fit" disabled={!open || preparing || joining} onClick={() => void actions.join()}>
          {joining ? "Joining…" : preparing ? "Getting ready…" : open ? "Join the call" : `Opens in ${formatCountdown(opens, now)}`}
        </Button>
        {!open && (
          <p className="text-caption text-ink-muted">
            The call opens at {formatTime(opens, timeZone)}. You can check your camera and microphone here until then.
          </p>
        )}

        <ul className="grid gap-2 border-t pt-5 text-caption text-ink-muted">
          <li>Find a quiet, private place. Headphones help others hear you clearly.</li>
          <li>Keep this page open during the call. {role === "patient" ? "Your doctor" : "Your patient"} can’t see you until you join.</li>
          <li>Calls are not recorded.</li>
        </ul>
      </div>
    </div>
  );
}

function CallStage({ call, now, peerName, timeZone, endsAt, hardStopAt, role }: ViewProps) {
  const [coarsePointer] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const stage = useRef<HTMLDivElement>(null);
  const { local, peer, actions } = call;
  const hardStop = new Date(hardStopAt);
  const closingSoon = hardStop.getTime() - now.getTime() <= CLOSING_WARNING_MS;

  // Full screen: stop the page behind from scrolling, and move focus into the call.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    stage.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const peerStatus = !peer.present
    ? peer.dropped
      ? `${peerName}’s connection dropped. Waiting for them to reconnect…`
      : peer.left
        ? `${peerName} left the call.`
        : `Waiting for ${peerName} to join…`
    : !peer.video
      ? `${peerName}’s camera is off.`
      : null;

  return (
    <div ref={stage} tabIndex={-1} role="region" aria-label={`Video call with ${peerName}`} className="fixed inset-0 z-50 flex flex-col bg-ink text-white focus:outline-none">
      <div className="relative flex-1 overflow-hidden">
        <div ref={call.remoteVideoRef} className={cn("absolute inset-0", !peer.video && "invisible")} />
        {peerStatus && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <div className="grid justify-items-center gap-4">
              <span aria-hidden="true" className="grid size-20 place-items-center rounded-full bg-white/10 text-h3">
                {initials(peerName)}
              </span>
              <p aria-live="polite" className="max-w-xs text-small text-white/80">
                {peerStatus}
              </p>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 grid gap-3 p-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <div className="flex items-center justify-between gap-3">
            <span className="glass flex min-w-0 items-center gap-2 rounded-full px-4 py-2 text-caption">
              <span className="truncate font-medium">{peerName}</span>
              {peer.present && !peer.audio && <MicOff aria-label="Microphone off" className="size-3.5 shrink-0" strokeWidth={2} />}
            </span>
            <span className="glass flex items-center gap-3 rounded-full px-4 py-2 text-caption">
              <span>Ends {formatTime(new Date(endsAt), timeZone)}</span>
              <NetworkIndicator signal={call.signal} />
            </span>
          </div>
          <div aria-live="polite" className="grid justify-items-center gap-2">
            {call.connection === "RECONNECTING" && <Banner>Reconnecting… Your call will continue when your connection is back.</Banner>}
            {call.notice && <Banner>{call.notice}</Banner>}
            {closingSoon && <Banner>This video call closes at {formatTime(hardStop, timeZone)}.</Banner>}
            {call.soundBlocked && (
              <button type="button" onClick={actions.resumeSound} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-caption font-medium text-ink">
                <Volume2 aria-hidden="true" className="size-4" strokeWidth={2} />
                Tap to turn on sound
              </button>
            )}
          </div>
        </div>

        <div className="absolute right-4 bottom-4 aspect-3/4 w-28 overflow-hidden rounded-field border border-white/20 bg-ink sm:aspect-video sm:w-48">
          <div ref={call.localVideoRef} className={cn("absolute inset-0", !(local.cam && local.camOn) && "invisible")} />
          {!(local.cam && local.camOn) && (
            <span className="absolute inset-0 grid place-items-center text-white/70">
              <VideoOff aria-label="Your camera is off" className="size-5" strokeWidth={2} />
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <ControlButton
          icon={local.micMuted ? MicOff : Mic}
          label={local.micMuted ? "Unmute microphone" : "Mute microphone"}
          pressed={local.micMuted}
          off={local.micMuted}
          disabled={!local.mic}
          onClick={() => void actions.toggleMic()}
        />
        <ControlButton
          icon={local.camOn ? Video : VideoOff}
          label={local.camOn ? "Turn camera off" : "Turn camera on"}
          pressed={!local.camOn}
          off={!local.camOn}
          disabled={!local.cam}
          onClick={() => void actions.toggleCamera()}
        />
        {coarsePointer && local.cameras.length > 1 && (
          <ControlButton icon={SwitchCamera} label="Switch camera" disabled={!local.cam || !local.camOn} onClick={() => void actions.flipCamera()} />
        )}
        <button
          type="button"
          onClick={() => void actions.leave()}
          className="ml-2 flex h-12 items-center gap-2 rounded-full bg-white px-5 text-small font-medium text-ink transition-colors duration-200 ease-out-soft hover:bg-white/90 sm:h-14 sm:px-6"
        >
          <PhoneOff aria-hidden="true" className="size-4" strokeWidth={2} />
          Leave
        </button>
        {role === "doctor" && <EndForBoth call={call} />}
      </div>
    </div>
  );
}

/**
 * The doctor's "End for both", in two taps (the second within 5 s), so it isn't hit by accident.
 * Disabled until the patient has been in the call: before that the doctor can only leave.
 */
function EndForBoth({ call }: { call: ConsultationCall }) {
  const [confirming, setConfirming] = useState(false);
  const disabled = !call.started || call.ending;

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 5000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      type="button"
      disabled={disabled}
      title={call.started ? undefined : "You can end the consultation for both once your patient has joined"}
      onClick={() => {
        if (!confirming) return setConfirming(true);
        setConfirming(false);
        void call.actions.endForBoth();
      }}
      className="flex h-12 items-center gap-2 rounded-full bg-alert px-5 text-small font-medium text-white transition-opacity duration-200 ease-out-soft disabled:opacity-50 sm:h-14 sm:px-6"
    >
      <CircleStop aria-hidden="true" className="size-4" strokeWidth={2} />
      {call.ending ? "Ending…" : confirming ? "Tap again to end for both" : "End for both"}
    </button>
  );
}

function Banner({ children }: { children: ReactNode }) {
  return <p className="glass max-w-md rounded-field px-4 py-2 text-center text-caption">{children}</p>;
}

function initials(name: string) {
  const words = name.replace(/^(Dr\.?|Prof\.?)\s+/i, "").split(/\s+/).filter(Boolean);
  return (words[0]?.[0] ?? "") + (words.length > 1 ? (words.at(-1)?.[0] ?? "") : "");
}
