import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { listAdminDoctors } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { formatPrice } from "@/lib/format";
import { centsToAmount } from "@/lib/money";
import { siteConfig } from "@/lib/site";
import { updatePricingAction } from "../actions";

export const metadata: Metadata = {
  title: "Pricing",
  robots: { index: false, follow: false },
};

export default async function AdminPricingPage() {
  const admin = await requireAdmin("/admin/pricing");
  const doctors = await listAdminDoctors(await getDb(), admin);

  return (
    <>
      <PageHeader
        title="Pricing"
        description={`Each doctor’s online consultation fee. Every consultation is ${siteConfig.booking.consultationMinutes} minutes. Changes apply to new bookings; existing bookings keep the fee they were booked at.`}
      />
      <AdminNav current="/admin/pricing" />
      <Container className="pb-section">
        <ul className="divide-y rounded-card border border-line">
          {doctors.map((doctor) => (
            <li key={doctor.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-start md:px-6">
              <div className="grid gap-1 text-small">
                <span className="text-h4">{doctor.name}</span>
                <span className="text-ink-muted">
                  Now {formatPrice(doctor.consultationFeeCents, doctor.currency)} for {doctor.consultationMinutes} minutes
                </span>
              </div>
              <ActionForm action={updatePricingAction} submitLabel="Save" variant="outline">
                <input type="hidden" name="doctorId" value={doctor.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-caption font-medium">
                    Fee ({doctor.currency})
                    <input name="fee" inputMode="decimal" required defaultValue={centsToAmount(doctor.consultationFeeCents)} className="field" />
                  </label>
                </div>
              </ActionForm>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
