import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { CancelForm } from "@/components/bookings/cancel-form";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { findPatientBooking } from "@/lib/account/queries";
import { requirePatient } from "@/lib/auth/session";
import { canPatientCancel } from "@/lib/booking/manage";
import { getDb } from "@/lib/db/server";
import { formatPrice, formatSlot } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { cancelOwnBookingAction } from "./actions";

export const metadata: Metadata = {
  title: "Your booking",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string }>;
};

/** One of the patient's bookings. Anyone else's booking is a 404, the same as one that doesn't exist. */
export default async function AccountBookingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const patient = await requirePatient(`/account/bookings/${encodeURIComponent(id)}`);
  const booking = await findPatientBooking(await getDb(), patient, id);
  if (!booking) notFound();

  const { cancelled } = await searchParams;
  const cancellable = canPatientCancel(booking);
  const { phone } = siteConfig.contact;
  const past = booking.endsAt.getTime() <= Date.now();

  return (
    <>
      <PageHeader
        eyebrow={`Booking ${booking.reference}`}
        breadcrumbs={[
          { label: "Your account", href: "/account" },
          past ? { label: "Past consultations", href: "/account/consultations" } : { label: "Upcoming bookings", href: "/account/bookings" },
        ]}
        title={
          <>
            Video consultation <span className="text-ink-subtle">with {booking.doctor.name}.</span>
          </>
        }
      />
      <Container className="grid gap-10 pb-section lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] lg:gap-16">
        <div className="grid content-start gap-6">
          {cancelled && booking.status === "cancelled" && (
            <p role="status" className="flex items-start gap-3 rounded-field bg-surface p-4 text-small">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={2} />
              <span>We’ve cancelled your consultation and emailed you a confirmation. You haven’t been charged.</span>
            </p>
          )}

          <Card className="md:p-8">
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
                <dd className="mt-1">{formatPrice(booking.feeCents, booking.currency)}</dd>
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
                <CancelForm action={cancelOwnBookingAction} target={booking.id} />
                <p className="mt-3 text-caption text-ink-muted">
                  You can cancel online until {siteConfig.booking.cancelUntilHours} hours before the start time.
                </p>
              </div>
            )}
            {booking.status === "confirmed" && !cancellable && !past && (
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
        <EmergencyNotice variant="inline" />
      </Container>
    </>
  );
}
