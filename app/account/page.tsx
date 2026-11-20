import type { Metadata } from "next";
import { AccountNav } from "@/components/account/account-nav";
import { AdminNav } from "@/components/admin/admin-nav";
import { DoctorNav } from "@/components/doctor/doctor-nav";
import { ChangePasswordForm, SignOutButton } from "@/components/auth/auth-forms";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const roleLabels = { patient: "Patient", doctor: "Doctor", admin: "Hospital administrator" } as const;

/** Profile for every signed-in user, whatever their role. */
export default async function AccountPage() {
  const user = await requireUser("/account");

  return (
    <>
      <PageHeader title="Your account" description={`Signed in as ${user.email}.`}>
        <SignOutButton />
      </PageHeader>
      {user.role === "patient" && <AccountNav current="/account" />}
      {user.role === "doctor" && <DoctorNav current="/account" />}
      {user.role === "admin" && <AdminNav current="/account" />}
      <Container className="grid gap-6 pb-20 md:grid-cols-2">
        <Card>
          <h2 className="text-h3">Profile</h2>
          <dl className="mt-6 grid gap-4 text-small">
            <div>
              <dt className="text-ink-muted">Name</dt>
              <dd className="mt-1 font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd className="mt-1 font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Account type</dt>
              <dd className="mt-1 font-medium">{roleLabels[user.role]}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-h3">Change password</h2>
          <div className="mt-6">
            <ChangePasswordForm />
          </div>
        </Card>
      </Container>
    </>
  );
}
