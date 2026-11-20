import { CalendarDays, Clock, Video } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DoctorPortrait } from "@/components/doctors/doctor-portrait";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Breadcrumbs } from "@/components/ui/page-header";
import { getSession, isPatient } from "@/lib/auth/session";
import { loadSlotQuery } from "@/lib/booking/availability";
import { listSlots } from "@/lib/booking/slots";
import { getDoctorBySlug } from "@/lib/db/queries";
import { getDb } from "@/lib/db/server";
import { formatDay, formatPrice, formatTime, formatTimeZoneName, isoDateIn } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { BookingForm, type SlotDay } from "./booking-form";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doctor = await getDoctorBySlug((await params).slug);
  if (!doctor) return {};
  return { title: `Book a video consultation with ${doctor.name}`, robots: { index: false } };
}

export default async function BookConsultationPage({ params }: Props) {
  const doctor = await getDoctorBySlug((await params).slug);
  if (!doctor) notFound();

  const user = await getSession();
  const patient = isPatient(user) ? { name: user.name, email: user.email } : null;
  const bookHref = `/doctors/${doctor.slug}/book`;

  const now = new Date();
  const slots = listSlots(await loadSlotQuery(await getDb(), doctor, now));

  // Group by calendar day in the doctor's time zone.
  const days: SlotDay[] = [];
  for (const slot of slots) {
    const key = isoDateIn(slot.start, doctor.timeZone);
    let day = days.at(-1);
    if (day?.key !== key) {
      day = {
        key,
        label: formatDay(slot.start, doctor.timeZone),
        weekday: new Intl.DateTimeFormat(siteConfig.locale, { weekday: "short", timeZone: doctor.timeZone }).format(slot.start),
        dayOfMonth: new Intl.DateTimeFormat(siteConfig.locale, { day: "numeric", timeZone: doctor.timeZone }).format(slot.start),
        slots: [],
      };
      days.push(day);
    }
    day.slots.push({ value: slot.start.toISOString(), label: formatTime(slot.start, doctor.timeZone) });
  }

  const timeZoneLabel = formatTimeZoneName(doctor.timeZone, now);

  return (
    <section aria-labelledby="book-title" className="pt-8 pb-section md:pt-12">
      <Container>
        <Breadcrumbs
          items={[
            { label: "Doctors", href: "/doctors" },
            { label: doctor.name, href: `/doctors/${doctor.slug}` },
          ]}
          className="mb-8"
        />
        <h1 id="book-title" className="max-w-3xl text-h1">
          Book a video consultation <span className="text-ink-subtle">with {doctor.name}.</span>
        </h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div className="grid content-start gap-10">
            <EmergencyNotice />
            <BookingForm
              doctorSlug={doctor.slug}
              doctorTimeZone={doctor.timeZone}
              timeZoneLabel={timeZoneLabel}
              feeLabel={`${formatPrice(doctor.consultationFeeCents, doctor.currency)} for ${doctor.consultationMinutes} minutes`}
              days={days}
              patient={patient}
              signInHref={user ? null : `/sign-in?next=${encodeURIComponent(bookHref)}`}
            />
          </div>

          <aside aria-label="Appointment summary" className="lg:sticky lg:top-8 lg:self-start">
            <Card className="grid gap-5 p-5 md:p-6">
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4">
                <DoctorPortrait doctor={doctor} sizes="72px" />
                <p>
                  <span className="block text-small font-medium">{doctor.name}</span>
                  <span className="text-caption text-ink-muted">{doctor.specialty}</span>
                </p>
              </div>
              <dl className="divide-y border-y text-small">
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="flex items-center gap-2 text-ink-muted">
                    <Video aria-hidden="true" className="size-4 text-brand-700" strokeWidth={1.75} />
                    Fee
                  </dt>
                  <dd className="text-h4 font-normal">{formatPrice(doctor.consultationFeeCents, doctor.currency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="flex items-center gap-2 text-ink-muted">
                    <Clock aria-hidden="true" className="size-4 text-brand-700" strokeWidth={1.75} />
                    Length
                  </dt>
                  <dd>{doctor.consultationMinutes} minutes</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="flex items-center gap-2 text-ink-muted">
                    <CalendarDays aria-hidden="true" className="size-4 text-brand-700" strokeWidth={1.75} />
                    Video days
                  </dt>
                  <dd className="text-right">{doctor.videoDays.join(", ") || "None"}</dd>
                </div>
              </dl>
              <p className="text-caption text-ink-muted">
                Cancel free of charge up to {siteConfig.booking.cancelUntilHours} hours before your appointment, using
                the link in your confirmation email.
              </p>
            </Card>
          </aside>
        </div>
      </Container>
    </section>
  );
}
