import type { Metadata } from "next";
import { DoctorDirectory } from "@/components/doctors/doctor-directory";
import { CtaBand } from "@/components/shared/cta-band";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { getCatalogueStats, listDepartments, listDoctors } from "@/lib/db/queries";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Find a doctor",
  description: "Browse our specialists by department and language, see their qualifications and fees, and book a video consultation.",
};

export default async function DoctorsPage() {
  const [doctors, departments, stats] = await Promise.all([listDoctors(), listDepartments(), getCatalogueStats()]);
  // Only offer departments that have at least one doctor to filter by.
  const departmentOptions = departments
    .filter((department) => doctors.some((doctor) => doctor.department === department.slug))
    .map(({ slug, name }) => ({ slug, name }));

  return (
    <>
      <PageHeader
        eyebrow="Doctor directory"
        title={
          <>
            Find a doctor <span className="text-ink-subtle">who fits you.</span>
          </>
        }
        description={`Filter by department or the language you’d like to speak. Video consultations start from ${formatPrice(stats.lowestFeeCents)}, and every fee is shown before you book.`}
      >
        <EmergencyNotice />
      </PageHeader>

      <section aria-label="Doctors" className="pb-section">
        <Container>
          <DoctorDirectory doctors={doctors} departments={departmentOptions} languages={stats.languages} />
        </Container>
      </section>

      <CtaBand flush />
    </>
  );
}
