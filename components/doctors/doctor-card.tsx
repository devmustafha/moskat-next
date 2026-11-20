import Link from "next/link";
import { DoctorPortrait } from "@/components/doctors/doctor-portrait";
import type { Doctor } from "@/lib/db/types";
import { formatPrice } from "@/lib/format";

type DoctorCardProps = {
  doctor: Doctor;
  /** Heading level for the doctor's name, so the card fits the page outline. */
  headingLevel?: "h2" | "h3";
};

/** Doctor summary that links to the full profile. The whole card is clickable. */
export function DoctorCard({ doctor, headingLevel: Heading = "h3" }: DoctorCardProps) {
  return (
    <article className="group relative flex flex-col">
      <DoctorPortrait
        doctor={doctor}
        sizes="(min-width: 75rem) 22vw, (min-width: 50.625rem) 30vw, 45vw"
        className="transition-transform duration-500 ease-out-soft group-hover:scale-[1.03]"
      />

      <Heading className="mt-5 text-h4">
        <Link
          href={`/doctors/${doctor.slug}`}
          className="after:absolute after:inset-0 after:rounded-card group-hover:text-brand-700"
        >
          {doctor.name}
        </Link>
      </Heading>
      <p className="mt-1 text-small text-ink-muted">{doctor.specialty}</p>

      <dl className="mt-4 space-y-1 text-caption">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink-muted">Experience</dt>
          <dd>{doctor.yearsExperience} years</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-ink-muted">Speaks</dt>
          <dd>{doctor.languages.join(", ")}</dd>
        </div>
      </dl>

      <div className="mt-auto pt-5">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t pt-4">
          <span className="text-h3 font-normal">{formatPrice(doctor.consultationFeeCents, doctor.currency)}</span>
          <span className="text-caption text-ink-muted">{doctor.consultationMinutes}-min video visit</span>
        </p>
      </div>
    </article>
  );
}
