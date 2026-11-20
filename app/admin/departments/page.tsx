import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { AdminNav } from "@/components/admin/admin-nav";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { listAdminDepartments } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db/server";
import { updateDepartmentAction } from "../actions";

export const metadata: Metadata = {
  title: "Departments",
  robots: { index: false, follow: false },
};

export default async function AdminDepartmentsPage() {
  const admin = await requireAdmin("/admin/departments");
  const departments = await listAdminDepartments(await getDb(), admin);

  return (
    <>
      <PageHeader title="Departments" description="The text shown on each department’s page, and whether it’s listed on the site." />
      <AdminNav current="/admin/departments" />
      <Container className="grid gap-6 pb-section">
        {departments.map((department) => (
          <Card key={department.id}>
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-h3">{department.name}</h2>
              <Link href={`/departments/${department.slug}`} className="link text-small">
                View page
              </Link>
            </div>
            <ActionForm action={updateDepartmentAction} submitLabel="Save" variant="outline">
              <input type="hidden" name="departmentId" value={department.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-caption font-medium">
                  Name
                  <input name="name" required maxLength={80} defaultValue={department.name} className="field" />
                </label>
                <label className="grid gap-2 text-caption font-medium">
                  Location
                  <input name="location" required maxLength={120} defaultValue={department.location} className="field" />
                </label>
                <label className="grid gap-2 text-caption font-medium sm:col-span-2">
                  Summary
                  <textarea name="summary" required maxLength={300} rows={2} defaultValue={department.summary} className="field" />
                </label>
                <label className="grid gap-2 text-caption font-medium sm:col-span-2">
                  Introduction
                  <textarea name="intro" required maxLength={2000} rows={5} defaultValue={department.intro} className="field" />
                </label>
                <label className="grid gap-2 text-caption font-medium">
                  Order on the site
                  <input name="sortOrder" type="number" min={0} max={1000} required defaultValue={department.sortOrder} className="field" />
                </label>
                <label className="flex items-center gap-3 self-end pb-3 text-small">
                  <input name="isActive" type="checkbox" defaultChecked={department.isActive} className="size-4 accent-brand-600" />
                  Listed on the site
                </label>
              </div>
            </ActionForm>
          </Card>
        ))}
      </Container>
    </>
  );
}
