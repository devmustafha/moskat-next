"use client";

import type { IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { SignalLevel } from "@/lib/consultation/call-ui";
import { cn } from "@/lib/utils";

/** Three bars for the call's network quality (Agora's network-quality event, every 2 s). */
export function NetworkIndicator({ signal, className }: { signal: SignalLevel; className?: string }) {
  return (
    <span role="img" aria-label={signal.label} title={signal.label} className={cn("inline-flex h-4 items-end gap-0.5", className)}>
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={cn(
            "w-1 rounded-full",
            bar === 1 ? "h-1.5" : bar === 2 ? "h-2.5" : "h-4",
            signal.bars >= bar ? (signal.bars === 1 ? "bg-alert" : "bg-brand-300") : "bg-white/30",
          )}
        />
      ))}
    </span>
  );
}

type ControlButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  /** Shown "off" (e.g. muted): inverted, so it stands out. */
  off?: boolean;
  disabled?: boolean;
  /** Lighter styling for use on the light lobby preview's dark box (same) or the call bar. */
  className?: string;
  pressed?: boolean;
};

/** A round call control (mute, camera, flip). */
export function ControlButton({ icon: Icon, label, onClick, off = false, disabled, className, pressed }: ControlButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-full transition-colors duration-200 ease-out-soft sm:size-14",
        "disabled:pointer-events-none disabled:opacity-40",
        off ? "bg-white text-ink hover:bg-white/90" : "bg-white/15 text-white hover:bg-white/25",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
    </button>
  );
}

/** A live microphone level, so people can see the microphone hears them before joining. */
export function MicLevel({ track, muted }: { track: IMicrophoneAudioTrack | null; muted: boolean }) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!track || muted) return;
    const timer = setInterval(() => setLevel(track.getVolumeLevel()), 150);
    return () => {
      clearInterval(timer);
      setLevel(0);
    };
  }, [track, muted]);

  const bars = Math.round(Math.min(1, level * 2.5) * 8);
  return (
    <span aria-hidden="true" className="inline-flex h-3 items-center gap-0.5">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className={cn("h-full w-1 rounded-full", i < bars ? "bg-brand-500" : "bg-line-strong")} />
      ))}
    </span>
  );
}

type DevicePickerProps = {
  id: string;
  label: string;
  devices: MediaDeviceInfo[];
  value: string | undefined;
  onChange: (deviceId: string) => void;
  disabled?: boolean;
};

/** Microphone or camera choice. Hidden when there's nothing to choose between. */
export function DevicePicker({ id, label, devices, value, onChange, disabled }: DevicePickerProps) {
  if (devices.length < 2) return null;
  return (
    <label htmlFor={id} className="grid gap-2 text-caption font-medium">
      {label}
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="field bg-canvas">
        {!devices.some((d) => d.deviceId === value) && <option value="">Default</option>}
        {devices.map((device, i) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `${label} ${i + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}
