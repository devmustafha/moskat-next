import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminNotice } from "@/components/admin/admin-notice";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { listAdminDoctors } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { siteConfig } from "@/lib/site";
import { createDoctorAccountAction, setDoctorAccountBlockedAction } from "../actions";

export const metadata: Metadata = {
  title: "Doctors",
  robots: { index: false, follow: false },
};

const { minPasswordLength, maxPasswordLength } = siteConfig.auth;

type Props = { searchParams: Promise<{ notice?: string; doctor?: string }> };

export default async function AdminDoctorsPage({ searchParams }: Props) {
  const admin = await requireAdmin("/admin/doctors");
  const doctors = await listAdminDoctors(await getDb(), admin);
  const params = await searchParams;
  const created = params.notice === "account-created" ? doctors.find((doctor) => String(doctor.id) === params.doctor) : undefined;

  return (
    <>
      <PageHeader
        title="Doctors"
        description="Give each doctor a sign-in account linked to their profile. They then see their own schedule, consultation queue and patients, and nothing else."
      />
      <AdminNav current="/admin/doctors" />
      {created?.account && (
        <AdminNotice>
          Account created for {created.name} ({created.account.email}). Give them their first password securely; they
          can change it under Your account.
        </AdminNotice>
      )}
      <Container className="pb-section">
        <ul className="divide-y rounded-card border border-line">
          {doctors.map((doctor) => (
            <li key={doctor.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:px-6">
              <div className="grid content-start gap-1 text-small">
                <Link href={`/doctors/${doctor.slug}`} className="link text-h4">
                  {doctor.name}
                </Link>
                <span className="text-ink-muted">
                  {doctor.specialty} · {doctor.department}
                  {!doctor.isActive && " · Not taking bookings"}
                </span>
              </div>

              {doctor.account ? (
                <div className="grid content-start gap-3 text-small">
                  <p>
                    Account: <span className="font-medium">{doctor.account.email}</span>
                    {doctor.account.banned && <span className="ml-2 text-alert">Blocked</span>}
                  </p>
                  <ActionForm
                    action={setDoctorAccountBlockedAction}
                    submitLabel={doctor.account.banned ? "Unblock account" : "Block account"}
                    confirm={doctor.account.banned ? undefined : "Block and sign the doctor out?"}
                    variant="outline"
                  >
                    <input type="hidden" name="doctorId" value={doctor.id} />
                    <input type="hidden" name="ban" value={doctor.account.banned ? "false" : "true"} />
                  </ActionForm>
                </div>
              ) : (
                <details className="text-small">
                  <summary className="cursor-pointer font-medium">Create sign-in account</summary>
                  <ActionForm action={createDoctorAccountAction} submitLabel="Create account" pendingLabel="Creating…" className="mt-4">
                    <input type="hidden" name="doctorId" value={doctor.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-2 text-caption font-medium">
                        Name
                        <input name="name" defaultValue={doctor.name} required maxLength={120} autoComplete="off" className="field" />
                      </label>
                      <label className="grid gap-2 text-caption font-medium">
                        Email
                        <input name="email" type="email" required maxLength={254} autoComplete="off" className="field" />
                      </label>
                      <label className="grid gap-2 text-caption font-medium sm:col-span-2">
                        First password
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={minPasswordLength}
                          maxLength={maxPasswordLength}
                          autoComplete="new-password"
                          className="field"
                        />
                        <span className="font-normal text-ink-muted">
                          At least {minPasswordLength} characters. Ask the doctor to change it after signing in.
                        </span>
                      </label>
                    </div>
                  </ActionForm>
                </details>
              )}
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
