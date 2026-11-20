import { ArrowUpRight, Video } from "lucide-react";
import Link from "next/link";
import { departmentIcons } from "@/components/departments/department-icon";
import { IconBadge } from "@/components/ui/icon-badge";
import type { Department } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type DepartmentListProps = {
  departments: Department[];
  /** Heading level for each department name, so the list fits the page outline. */
  headingLevel?: "h2" | "h3";
  /** Badge background: `canvas` on grey sections, `surface` on white ones. */
  tone?: "canvas" | "surface";
  className?: string;
};

/** A directory rather than a card grid: easier to scan, and each row reads as one department. */
export function DepartmentList({ departments, headingLevel: Heading = "h3", tone = "canvas", className }: DepartmentListProps) {
  return (
    <ul className={cn("grid border-t border-line-strong lg:grid-cols-2 lg:gap-x-16", className)}>
      {departments.map((department) => (
        <li key={department.slug} className="group relative flex gap-5 border-b border-line-strong py-7 md:py-8">
          <IconBadge
            icon={departmentIcons[department.icon]}
            size="lg"
            className={cn(
              "transition-colors duration-200 ease-out-soft group-hover:bg-brand-600 group-hover:text-white",
              tone === "canvas" ? "bg-canvas" : "bg-surface",
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <Heading className="text-h3">
                <Link href={`/departments/${department.slug}`} className="after:absolute after:inset-0">
                  {department.name}
                </Link>
              </Heading>
              {department.onlineConsultations && (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-700">
                  <Video aria-hidden="true" className="size-3.5" strokeWidth={2} />
                  Video visits
                </p>
              )}
            </div>
            <p className="mt-2 max-w-md text-small text-ink-muted">{department.summary}</p>
            <p className="mt-3 flex items-center justify-between gap-4 text-caption text-ink">
              <span>
                <span className="sr-only">Services: </span>
                {department.services.map((service) => service.name).join(" · ")}
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 shrink-0 text-ink-muted transition-transform duration-300 ease-out-soft group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-700"
              />
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
