import Link from "next/link";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import type { QueueBooking } from "@/lib/doctor/queries";
import { formatDay, formatTime, isoDateIn } from "@/lib/format";

type ConsultationListProps = {
  bookings: QueueBooking[];
  timeZone: string;
  /** Link each patient's name to their page (off on the patient page itself). */
  linkPatients?: boolean;
  /** Label for the current day's heading, e.g. "Today". */
  todayKey?: string;
};

/** A doctor's consultations grouped by day, in the doctor's time zone. */
export function ConsultationList({ bookings, timeZone, linkPatients = true, todayKey }: ConsultationListProps) {
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
                <BookingStatusBadge status={booking.status} className="w-fit" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
