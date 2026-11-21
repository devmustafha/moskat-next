import Link from "next/link";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { ButtonLink } from "@/components/ui/button";
import { consultationWindow } from "@/lib/consultation/access";
import type { QueueBooking } from "@/lib/doctor/queries";
import { formatDay, formatTime, isoDateIn } from "@/lib/format";

type ConsultationListProps = {
  bookings: QueueBooking[];
  timeZone: string;
  /** Link each patient's name to their page (off on the patient page itself). */
  linkPatients?: boolean;
  /** Label for the current day's heading, e.g. "Today". */
  todayKey?: string;
  /** Show the way into each paid consultation's video call, as of this time (the queue). */
  now?: Date;
};

/** "Join call" once the call is open; "Video room" earlier the same day (to test devices). */
function CallLink({ booking, now, today }: { booking: QueueBooking; now: Date; today: boolean }) {
  if (!booking.paid || (booking.status !== "confirmed" && booking.status !== "in_progress")) return null;
  const { opensAt, hardStopAt } = consultationWindow(booking);
  if (now >= hardStopAt) return null;
  const href = `/consultations/${booking.id}`;
  if (now >= opensAt) {
    return (
      <ButtonLink href={href} variant="brand" size="sm" withIcon={false}>
        Join call
      </ButtonLink>
    );
  }
  if (!today) return null;
  return (
    <Link href={href} className="link text-caption">
      Video room
    </Link>
  );
}

/** A doctor's consultations grouped by day, in the doctor's time zone. */
export function ConsultationList({ bookings, timeZone, linkPatients = true, todayKey, now }: ConsultationListProps) {
  const days: { key: string; label: string; bookings: QueueBooking[] }[] = [];
  for (const booking of bookings) {
    const key = isoDateIn(booking.startsAt, timeZone);
    let day = days.at(-1);
    if (day?.key !== key) {
      const label = formatDay(booking.startsAt, timeZone);
      day = { key, label: key === todayKey ? `Today, ${label}` : label, bookings: [] };
      days.push(day);
    }
    day.bookings.push(booking);
  }

  return (
    <div className="grid gap-8">
      {days.map((day) => (
        <section key={day.key} aria-label={day.label}>
          <h2 className="text-h4">{day.label}</h2>
          <ul className="mt-3 divide-y rounded-card border border-line">
            {day.bookings.map((booking) => (
              <li key={booking.id} className="grid gap-2 p-5 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6 md:px-6">
                <span className="text-small font-medium">
                  {formatTime(booking.startsAt, timeZone)}–{formatTime(booking.endsAt, timeZone)}
                </span>
                <span className="grid gap-1 text-small">
                  <span className="font-medium">
                    {booking.patientName === null ? (
                      <span className="text-ink-muted">Patient details removed</span>
                    ) : linkPatients && booking.patientUserId ? (
                      <Link href={`/doctor/patients/${booking.patientUserId}`} className="link">
                        {booking.patientName}
                      </Link>
                    ) : (
                      booking.patientName
                    )}
                  </span>
                  <span className="text-ink-muted">
                    {[booking.patientEmail, booking.patientPhone, `Ref ${booking.reference}`].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <BookingStatusBadge status={booking.status} className="w-fit" />
                  {now && <CallLink booking={booking} now={now} today={day.key === todayKey} />}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
