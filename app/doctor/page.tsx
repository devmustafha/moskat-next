import type { Metadata } from "next";
import Link from "next/link";
import { DoctorNav } from "@/components/doctor/doctor-nav";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { requireDoctor } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { getDoctorSchedule } from "@/lib/doctor/queries";
import { formatDate, formatPrice, formatSlot, formatTimeZoneName, formatWallTime, formatWeekday, isoDateIn } from "@/lib/format";

export const metadata: Metadata = {
  title: "Your schedule",
  robots: { index: false, follow: false },
};

/** The signed-in doctor's weekly video hours and time off at a glance. Hours are edited on /doctor/hours; time off by the hospital. */
export default async function DoctorSchedulePage() {
  const doctor = await requireDoctor("/doctor");
  const now = new Date();
  const { profile, hours, timeOff } = await getDoctorSchedule(await getDb(), doctor, now);
  const today = isoDateIn(now, profile.timeZone);

  const weekdays = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    rules: hours.filter((rule) => rule.weekday === weekday),
  }));

  return (
    <>
      <PageHeader
        title="Your schedule"
        description={
          <>
            Weekly video consultation hours for{" "}
            <Link href={`/doctors/${profile.slug}`} className="link">
              {profile.name}
            </Link>
            , in {formatTimeZoneName(profile.timeZone, now)}. Change your hours and rates under{" "}
            <Link href="/doctor/hours" className="link">
              Weekly hours
            </Link>{" "}
            and{" "}
            <Link href="/doctor/profile" className="link">
              Profile and rates
            </Link>
            ; for time off, contact the hospital.
          </>
        }
      />
      <DoctorNav current="/doctor" />
      <Container className="grid gap-6 pb-section lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <Card>
          <h2 className="text-h3">Weekly hours</h2>
          <p className="mt-2 text-small text-ink-muted">
            {formatPrice(profile.consultationFeeCents, profile.currency)} for {profile.consultationMinutes} minutes ·{" "}
            {profile.specialty}
          </p>
          <dl className="mt-6 divide-y border-y text-small">
            {weekdays.map(({ weekday, rules }) => (
              <div key={weekday} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-4 py-3">
                <dt className="font-medium">{formatWeekday(weekday)}</dt>
                <dd className="grid gap-1">
                  {rules.length === 0 ? (
                    <span className="text-ink-muted">No video hours</span>
                  ) : (
                    rules.map((rule) => (
                      <span key={`${rule.startTime}-${rule.effectiveFrom}`}>
                        {formatWallTime(rule.startTime)}–{formatWallTime(rule.endTime)}
                        {(rule.effectiveFrom > today || rule.effectiveUntil) && (
                          <span className="text-ink-muted">
                            {rule.effectiveFrom > today && ` from ${formatDate(rule.effectiveFrom)}`}
                            {rule.effectiveUntil && ` until ${formatDate(rule.effectiveUntil)}`}
                          </span>
                        )}
                      </span>
                    ))
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <h2 className="text-h3">Time off</h2>
          {timeOff.length === 0 ? (
            <p className="mt-6 text-small text-ink-muted">No time off booked.</p>
          ) : (
            <ul className="mt-6 grid gap-4 text-small">
              {timeOff.map((entry) => (
                <li key={entry.startsAt.toISOString()} className="grid gap-1">
                  <span className="font-medium">
                    {formatSlot(entry.startsAt, profile.timeZone)} to {formatSlot(entry.endsAt, profile.timeZone)}
                  </span>
                  {entry.note && <span className="text-ink-muted">{entry.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Container>
    </>
  );
}
