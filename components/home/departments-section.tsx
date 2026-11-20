import { DepartmentList } from "@/components/departments/department-list";
import { ButtonLink } from "@/components/ui/button";
import { Section } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { listDepartments } from "@/lib/db/queries";

export async function DepartmentsSection() {
  const departments = await listDepartments();
  return (
    <Section id="departments" tone="surface" aria-labelledby="departments-title">
      <SectionHeading
        id="departments-title"
        title="Departments and services"
        description="From a first check-up to complex treatment, our departments work together so you don’t have to repeat your story."
        action={
          <ButtonLink href="/departments" variant="outline">
            All departments
          </ButtonLink>
        }
      />
      <DepartmentList departments={departments} className="mt-12 md:mt-16" />
    </Section>
  );
}
