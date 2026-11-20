import Link from "next/link";
import type { ReactNode } from "react";
import type { ManagedBooking } from "@/lib/booking/manage";
import { formatPrice, formatSlot } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BookingStatusBadge } from "./booking-status";

type BookingListProps = {
  bookings: ManagedBooking[];
  /** Link for each booking's detail page. */
  hrefFor: (booking: ManagedBooking) => string;
  /** Shown when there are no bookings. */
  empty: ReactNode;
};

/** A patient's bookings as a list of rows linking to each booking. */
export function BookingList({ bookings, hrefFor, empty }: BookingListProps) {
  if (bookings.length === 0) {
    return <div className="rounded-card border border-dashed border-line-strong p-8 text-center text-small text-ink-muted">{empty}</div>;
  }

  return (
    <ul className="divide-y rounded-card border border-line">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Link
            href={hrefFor(booking)}
            className="grid gap-2 p-5 transition-colors duration-200 ease-out-soft hover:bg-surface sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 md:px-6"
          >
            <span className="grid gap-1">
              <span className={cn("text-h4", booking.status === "cancelled" && "text-ink-muted line-through")}>
                {formatSlot(booking.startsAt, booking.doctor.timeZone)}
              </span>
              <span className="text-small text-ink-muted">
                {booking.doctor.name} · {booking.doctor.specialty} · {formatPrice(booking.feeCents, booking.currency)} ·
                Ref {booking.reference}
              </span>
            </span>
            <BookingStatusBadge status={booking.status} className="w-fit" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
