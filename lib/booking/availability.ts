import { and, asc, eq, gt, lt, ne, or } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { consultationBookings, doctorAvailability, doctors, doctorTimeOff } from "@/lib/db/schema";
import { siteConfig } from "@/lib/site";
import type { SlotQuery } from "./slots";

const DAY = 24 * 60 * 60 * 1000;

export type BookableDoctor = {
  id: number;
  slug: string;
  name: string;
  specialty: string;
  consultationFeeCents: number;
  currency: string;
  consultationMinutes: number;
  timeZone: string;
};

/** An active doctor by slug, with just the fields booking needs. */
export async function findBookableDoctor(db: Db, slug: string): Promise<BookableDoctor | null> {
  const [doctor] = await db
    .select({
      id: doctors.id,
      slug: doctors.slug,
      name: doctors.name,
      specialty: doctors.specialty,
      consultationFeeCents: doctors.consultationFeeCents,
      currency: doctors.currency,
      consultationMinutes: doctors.consultationMinutes,
      timeZone: doctors.timeZone,
    })
    .from(doctors)
    .where(and(eq(doctors.slug, slug), eq(doctors.isActive, true)))
    .limit(1);
  return doctor ?? null;
}

/**
 * Everything needed to list a doctor's free slots right now: weekly hours, plus time off and
 * slot-holding bookings inside the booking window.
 */
export async function loadSlotQuery(db: Db, doctor: BookableDoctor, now: Date): Promise<SlotQuery> {
  const { leadTimeMinutes, horizonDays } = siteConfig.booking;
  const windowEnd = new Date(now.getTime() + (horizonDays + 1) * DAY);

  const [rules, timeOff, booked] = await Promise.all([
    db
      .select({
        weekday: doctorAvailability.weekday,
        startTime: doctorAvailability.startTime,
        endTime: doctorAvailability.endTime,
        effectiveFrom: doctorAvailability.effectiveFrom,
        effectiveUntil: doctorAvailability.effectiveUntil,
      })
      .from(doctorAvailability)
      .where(eq(doctorAvailability.doctorId, doctor.id)),
    db
      .select({ start: doctorTimeOff.startsAt, end: doctorTimeOff.endsAt })
      .from(doctorTimeOff)
      .where(and(eq(doctorTimeOff.doctorId, doctor.id), lt(doctorTimeOff.startsAt, windowEnd), gt(doctorTimeOff.endsAt, now))),
    db
      .select({ start: consultationBookings.startsAt, end: consultationBookings.endsAt })
      .from(consultationBookings)
      .where(
        and(
          eq(consultationBookings.doctorId, doctor.id),
          ne(consultationBookings.status, "cancelled"),
          // A lapsed unpaid hold no longer holds its slot (see isLiveHold in ./status).
          or(ne(consultationBookings.status, "pending_payment"), gt(consultationBookings.paymentExpiresAt, now)),
          lt(consultationBookings.startsAt, windowEnd),
          gt(consultationBookings.endsAt, now),
        ),
      )
      .orderBy(asc(consultationBookings.startsAt)),
  ]);

  return {
    rules,
    timeZone: doctor.timeZone,
    minutes: doctor.consultationMinutes,
    busy: [...timeOff, ...booked],
    now,
    leadTimeMinutes,
    horizonDays,
  };
}
