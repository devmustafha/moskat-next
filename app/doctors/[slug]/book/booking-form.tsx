"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { type BookingFormState, createBookingAction } from "./actions";

export type SlotDay = {
  /** Calendar date in the doctor's time zone (YYYY-MM-DD). */
  key: string;
  /** "Monday, November 23" */
  label: string;
  /** "Mon" and "23" for the compact day picker. */
  weekday: string;
  dayOfMonth: string;
  slots: { value: string; label: string }[];
};

type BookingFormProps = {
  doctorSlug: string;
  doctorTimeZone: string;
  timeZoneLabel: string;
  /** "$45 for 30 minutes", repeated next to the confirm button. */
  feeLabel: string;
  days: SlotDay[];
  /** A signed-in patient's name and email, to prefill the form. The booking is linked to their account. */
  patient?: { name: string; email: string } | null;
  /** Sign-in link that comes back here; null when someone other than a patient is signed in (they book as guests). */
  signInHref: string | null;
};

const initialState: BookingFormState = { status: "idle" };

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-caption text-alert">
      {errors[0]}
    </p>
  );
}

export function BookingForm({ doctorSlug, doctorTimeZone, timeZoneLabel, feeLabel, days, patient, signInHref }: BookingFormProps) {
  const [state, formAction, pending] = useActionState(createBookingAction, initialState);
  const [removed, setRemoved] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dayKey, setDayKey] = useState(days[0]?.key ?? "");
  const [viewerTimeZone, setViewerTimeZone] = useState<string | null>(null);
  const ids = { name: useId(), email: useId(), phone: useId(), consent: useId(), slots: useId(), error: useId() };

  useEffect(() => setViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  // A slot someone else just booked disappears from the picker.
  useEffect(() => {
    const unavailable = state.unavailable;
    if (!unavailable) return;
    setRemoved((list) => (list.includes(unavailable) ? list : [...list, unavailable]));
    setSelected((value) => (value === unavailable ? null : value));
  }, [state]);

  const visibleDays = useMemo(
    () =>
      days
        .map((day) => ({ ...day, slots: day.slots.filter((slot) => !removed.includes(slot.value)) }))
        .filter((day) => day.slots.length > 0),
    [days, removed],
  );
  const activeDay = visibleDays.find((day) => day.key === dayKey) ?? visibleDays[0];

  const localHint =
    selected && viewerTimeZone && viewerTimeZone !== doctorTimeZone
      ? new Intl.DateTimeFormat(undefined, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(new Date(selected))
      : null;

  if (visibleDays.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong p-8 text-center">
        <p className="text-h4">No video appointments are free in the next few weeks</p>
        <p className="mt-2 text-small text-ink-muted">
          Please try another doctor, or call us and we’ll find you a time.
        </p>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-10" noValidate>
      <input type="hidden" name="doctorSlug" value={doctorSlug} />

      <fieldset className="grid gap-5" aria-describedby={errors.startsAt ? ids.error : undefined}>
        <legend className="text-h3">1. Choose a time</legend>
        <p className="mt-1.5 text-small text-ink-muted">Times shown in {timeZoneLabel}.</p>

        <div role="tablist" aria-label="Day" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {visibleDays.map((day) => {
            const active = day.key === activeDay?.key;
            return (
              <button
                key={day.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={day.label}
                onClick={() => setDayKey(day.key)}
                className={cn(
                  "grid min-w-16 shrink-0 place-items-center rounded-field border px-3 py-2.5 transition-colors duration-200 ease-out-soft",
                  active ? "border-ink bg-ink text-white" : "border-line bg-canvas hover:border-line-strong",
                )}
              >
                <span className={cn("text-caption", active ? "text-white/75" : "text-ink-muted")}>{day.weekday}</span>
                <span className="text-h4">{day.dayOfMonth}</span>
              </button>
            );
          })}
        </div>

        {activeDay && (
          <div role="tabpanel" aria-label={activeDay.label}>
            <p className="text-small font-medium">{activeDay.label}</p>
            <div id={ids.slots} className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {activeDay.slots.map((slot) => (
                <label
                  key={slot.value}
                  className={cn(
                    "cursor-pointer rounded-field border py-2.5 text-center text-small transition-colors duration-200 ease-out-soft",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500",
                    selected === slot.value
                      ? "border-brand-600 bg-brand-600 font-medium text-white"
                      : "border-line bg-canvas hover:border-brand-400",
                  )}
                >
                  <input
                    type="radio"
                    name="slotChoice"
                    value={slot.value}
                    checked={selected === slot.value}
                    onChange={() => setSelected(slot.value)}
                    className="sr-only"
                  />
                  {slot.label}
                </label>
              ))}
            </div>
          </div>
        )}
        {/*
          The chosen time is submitted from React state, not from the radios: React resets the form
          after each action, which would uncheck the radio while the UI still shows it selected.
          This also keeps the choice when another day's tab is open.
        */}
        <input type="hidden" name="startsAt" value={selected ?? ""} />
        {localHint && <p className="text-caption text-ink-muted">That’s {localHint} where you are.</p>}
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="text-h3">2. Your details</legend>
        <p className="mt-1.5 text-small text-ink-muted">
          We only ask for what we need to run your appointment. Please don’t share medical details here; your doctor
          will ask during the call.
        </p>
        <p className="text-small text-ink-muted">
          {patient ? (
            <>This booking will also appear in your account.</>
          ) : signInHref && (
            <>
              Have an account?{" "}
              <Link href={signInHref} className="link text-ink">
                Sign in
              </Link>{" "}
              to see this booking there too. You don’t need one to book.
            </>
          )}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label htmlFor={ids.name} className="grid gap-2 text-caption font-medium">
            Full name
            <input
              id={ids.name}
              name="name"
              autoComplete="name"
              defaultValue={state.values?.name ?? patient?.name}
              required
              maxLength={120}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${ids.name}-error` : undefined}
              className={cn("field", errors.name && "border-alert")}
            />
            <FieldError id={`${ids.name}-error`} errors={errors.name} />
          </label>
          <label htmlFor={ids.email} className="grid gap-2 text-caption font-medium">
            Email
            <input
              id={ids.email}
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.values?.email ?? patient?.email}
              required
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? `${ids.email}-error` : undefined}
              className={cn("field", errors.email && "border-alert")}
            />
            <FieldError id={`${ids.email}-error`} errors={errors.email} />
          </label>
          <label htmlFor={ids.phone} className="grid gap-2 text-caption font-medium sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
            <span>
              Phone <span className="font-normal text-ink-muted">(optional, in case the video call drops)</span>
            </span>
            <input
              id={ids.phone}
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={state.values?.phone}
              maxLength={32}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? `${ids.phone}-error` : undefined}
              className={cn("field", errors.phone && "border-alert")}
            />
            <FieldError id={`${ids.phone}-error`} errors={errors.phone} />
          </label>
        </div>

        {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
        <div aria-hidden="true" className="sr-only">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <label htmlFor={ids.consent} className="flex items-start gap-3 text-small">
          <input
            id={ids.consent}
            name="consent"
            type="checkbox"
            defaultChecked={state.values?.consent}
            required
            aria-invalid={Boolean(errors.consent)}
            className="mt-1 size-4 shrink-0 accent-brand-600"
          />
          <span>
            I’ve read the{" "}
            <Link href="/privacy" className="link" target="_blank">
              privacy notice
            </Link>{" "}
            and agree to {siteConfig.name} using these details to arrange my consultation.
            <FieldError id={`${ids.consent}-error`} errors={errors.consent} />
          </span>
        </label>
      </fieldset>

      <div className="grid gap-4">
        {state.status === "error" && state.message && (
          <p id={ids.error} role="alert" className="rounded-field bg-alert-soft p-4 text-small text-alert">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="justify-between sm:w-fit sm:justify-center">
          {pending ? "Booking…" : "Confirm booking"}
        </Button>
        <p className="text-caption text-ink-muted">
          Fee: <strong className="font-medium text-ink">{feeLabel}</strong>. Your booking is confirmed straight away
          and we’ll email you a link to view or cancel it. Our patient team will send payment details before your
          appointment.
        </p>
      </div>
    </form>
  );
}
