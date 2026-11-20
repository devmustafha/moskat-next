import { DoctorCard } from "@/components/doctors/doctor-card";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/container";
import { Grid } from "@/components/ui/grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { listDoctors } from "@/lib/db/queries";

export async function DoctorsSection() {
  const doctors = await listDoctors();
  return (
    <Section id="doctors" aria-labelledby="doctors-title">
      <SectionHeading
        id="doctors-title"
        eyebrow="Video consultations"
        title={
          <>
            Meet the people <span className="text-ink-subtle">behind your care.</span>
          </>
        }
        description="Choose a specialist and book a video visit. Every fee and visit length is shown up front, before you pay."
        action={
          <ButtonLink href="/doctors" variant="outline">
            See all {doctors.length} doctors
          </ButtonLink>
        }
      />

      <Grid cols={4} className="mt-12 grid-cols-2 gap-x-4 gap-y-12 md:mt-16 md:gap-x-5 md:gap-y-14">
        {doctors.slice(0, 4).map((doctor) => (
          <DoctorCard key={doctor.slug} doctor={doctor} />
        ))}
      </Grid>
    </Section>
  );
}
