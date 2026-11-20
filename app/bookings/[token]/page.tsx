import { CheckCircle2, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { CancelForm } from "@/components/bookings/cancel-form";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { canPatientCancel, findBookingByToken } from "@/lib/booking/manage";
import { getDb } from "@/lib/db/server";
import { formatPrice, formatSlot } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { cancelBookingAction } from "./actions";

// Private page: never indexed, and the token in the URL is never sent on as a referrer.
// middleware.ts also sets Cache-Control: private, no-store for /bookings/*.
export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ new?: string; email?: string; cancelled?: string }>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const { token } = await params;
  const flags = await searchParams;
  const booking = await findBookingByToken(await getDb(), token);
  if (!booking) notFound();

  const cancellable = canPatientCancel(booking);
  const { phone } = siteConfig.contact;

  return (
    <section aria-labelledby="booking-title" className="pt-8 pb-section md:pt-12">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
        <div>
          <Eyebrow>Booking {booking.reference}</Eyebrow>
          <h1 id="booking-title" className="mt-6 text-h1">
            {booking.status === "cancelled" ? (
              <>
                Booking cancelled. <span className="text-ink-subtle">Your slot has been released.</span>
              </>
            ) : (
              <>
                Your video consultation <span className="text-ink-subtle">with {booking.doctor.name}.</span>
              </>
            )}
          </h1>

          {flags.new && booking.status === "confirmed" && (
            <p role="status" className="mt-8 flex items-start gap-3 rounded-field bg-brand-50 p-4 text-small text-brand-800">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <span>
                <strong className="font-semibold">You’re booked.</strong>{" "}
                {flags.email === "failed"
                  ? "We couldn’t send your confirmation email, so please bookmark this page: its link is the only way to view or cancel your booking online."
                  : `We’ve emailed a confirmation to ${booking.patientEmail}. Keep its link private: anyone with it can see and cancel this booking.`}
              </span>
            </p>
          )}
          {flags.cancelled && booking.status === "cancelled" && (
            <p role="status" className="mt-8 flex items-start gap-3 rounded-field bg-surface p-4 text-small">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={2} />
              <span>We’ve cancelled your consultation and emailed you a confirmation. You haven’t been charged.</span>
            </p>
          )}

          <Card className="mt-8 md:p-8">
            <dl className="grid gap-5 text-small sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-ink-muted">When</dt>
                <dd className={cn("mt-1 text-h4", booking.status === "cancelled" && "text-ink-muted line-through")}>
                  {formatSlot(booking.startsAt, booking.doctor.timeZone)}
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Doctor</dt>
                <dd className="mt-1">
                  <Link href={`/doctors/${booking.doctor.slug}`} className="link font-medium">
                    {booking.doctor.name}
                  </Link>
                  <span className="block text-ink-muted">{booking.doctor.specialty}</span>
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Status</dt>
                <dd className="mt-1">
                  <BookingStatusBadge status={booking.status} />
                </dd>
              </div>
              <div>
                <dt className="text-ink-muted">Fee</dt>
                <dd className="mt-1">{formatPrice(booking.feeCents, booking.currency)}, paid before the call</dd>
              </div>
              {booking.patientName && (
                <div>
                  <dt className="text-ink-muted">Patient</dt>
                  <dd className="mt-1">{booking.patientName}</dd>
                </div>
              )}
            </dl>

            {cancellable && (
              <div className="mt-8 border-t pt-6">
                <CancelForm action={cancelBookingAction} target={token} />
                <p className="mt-3 text-caption text-ink-muted">
                  You can cancel online until {siteConfig.booking.cancelUntilHours} hours before the start time.
                </p>
              </div>
            )}
            {booking.status === "confirmed" && !cancellable && (
              <p className="mt-8 border-t pt-6 text-small text-ink-muted">
                It’s too late to cancel online. To change this appointment, call us on{" "}
                <a href={phone.href} className="link text-ink">
                  {phone.label}
                </a>
                .
              </p>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-5">
          {booking.status === "confirmed" && (
            <Card tone="muted" className="md:p-8">
              <h2 className="text-h4">What happens next</h2>
              <ol className="mt-4 grid gap-3 text-small text-ink-muted">
                <li>1. Our patient team sends payment details before your appointment.</li>
                <li>2. We email your video link on the day. There’s no app to install.</li>
                <li>3. Join a few minutes early from a quiet, private space.</li>
              </ol>
            </Card>
          )}
          {booking.status === "cancelled" && (
            <ButtonLink href="/doctors" className="justify-between sm:w-fit">
              Book another time
            </ButtonLink>
          )}
          <EmergencyNotice variant="inline" />
        </div>
      </Container>
    </section>
  );
}
