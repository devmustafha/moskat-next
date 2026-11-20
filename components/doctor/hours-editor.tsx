"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { HOURS_LIMITS, type HoursWindow } from "@/lib/doctor/hours";
import { formatWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = { key: number; start: string; end: string };
type Week = Record<number, Row[]>;

type HoursEditorProps = {
  /** Server action. Reads repeated weekday/start/end fields and checks the doctor session itself. */
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  /** The weekly hours in effect today ("HH:MM"). */
  initial: HoursWindow[];
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];
const idle: ActionState = { status: "idle" };

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** A new window: 09:00–12:00, or the hour after the day's last window. */
function nextWindow(rows: Row[]): Pick<Row, "start" | "end"> {
  const last = rows.at(-1);
  if (!last?.end) return { start: "09:00", end: "12:00" };
  const start = Math.min(toMinutes(last.end), 23 * 60);
  return { start: toTime(start), end: toTime(Math.min(start + 60, 23 * 60 + 55)) };
}

/**
 * Weekly video hours: up to four windows per weekday, in the doctor's time zone. The server
 * validates everything again; this only makes rows easy to add and remove.
 */
export function HoursEditor({ action, initial }: HoursEditorProps) {
  const [state, formAction, pending] = useActionState(action, idle);
  const nextKey = useRef(initial.length);
  const [week, setWeek] = useState<Week>(() =>
    Object.fromEntries(
      WEEKDAYS.map((weekday) => [
        weekday,
        initial
          .map((window, index) => ({ ...window, index }))
          .filter((window) => window.weekday === weekday)
          .map((window) => ({ key: window.index, start: window.startTime, end: window.endTime })),
      ]),
    ),
  );
  // Disabled until hydrated, so an early click is never a native submit of a half-built form.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const update = (weekday: number, rows: Row[]) => setWeek((current) => ({ ...current, [weekday]: rows }));

  return (
    <form method="post" action={formAction} className="grid gap-6">
      <div className="divide-y border-y">
        {WEEKDAYS.map((weekday) => {
          const rows = week[weekday];
          const day = formatWeekday(weekday);
          return (
            <div
              key={weekday}
              role="group"
              aria-labelledby={`hours-day-${weekday}`}
              className="grid gap-3 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4"
            >
              <span id={`hours-day-${weekday}`} className="text-small font-medium sm:pt-3">
                {day}
              </span>
              <div className="grid gap-3">
                {rows.length === 0 && <p className="text-small text-ink-muted sm:pt-3">No video hours</p>}
                {rows.map((row, index) => (
                  <div key={row.key} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="weekday" value={weekday} />
                    <input
                      type="time"
                      name="start"
                      step={HOURS_LIMITS.stepMinutes * 60}
                      required
                      value={row.start}
                      onChange={(event) => update(weekday, rows.map((r) => (r.key === row.key ? { ...r, start: event.target.value } : r)))}
                      aria-label={`${day}, window ${index + 1}, start`}
                      className="field w-auto"
                    />
                    <span aria-hidden="true" className="text-ink-muted">
                      to
                    </span>
                    <input
                      type="time"
                      name="end"
                      step={HOURS_LIMITS.stepMinutes * 60}
                      required
                      value={row.end}
                      onChange={(event) => update(weekday, rows.map((r) => (r.key === row.key ? { ...r, end: event.target.value } : r)))}
                      aria-label={`${day}, window ${index + 1}, end`}
                      className="field w-auto"
                    />
                    <button
                      type="button"
                      onClick={() => update(weekday, rows.filter((r) => r.key !== row.key))}
                      className="link text-caption"
                      aria-label={`Remove ${day} window ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {rows.length < HOURS_LIMITS.windowsPerDay && (
                  <button
                    type="button"
                    onClick={() => update(weekday, [...rows, { key: nextKey.current++, ...nextWindow(rows) }])}
                    className="link justify-self-start text-caption"
                  >
                    Add hours{rows.length > 0 ? " on this day" : ""}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" withIcon={false} disabled={pending || !hydrated}>
          {pending ? "Saving…" : "Save weekly hours"}
        </Button>
      </div>
      {state.message && (
        <p role={state.status === "error" ? "alert" : "status"} className={cn("text-caption", state.status === "error" ? "text-alert" : "text-brand-700")}>
          {state.message}
        </p>
      )}
    </form>
  );
}
