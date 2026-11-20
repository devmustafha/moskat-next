import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Opening hours for each service, from siteConfig.hours. */
export function OpeningHours({ className }: { className?: string }) {
  return (
    <dl className={cn("divide-y border-y text-small", className)}>
      {siteConfig.hours.map((entry) => (
        <div key={entry.service} className="py-3">
          <dt className="flex items-center gap-2 font-medium">
            {"emergency" in entry && entry.emergency && (
              <span aria-hidden="true" className="size-2 rounded-full bg-alert" />
            )}
            {entry.service}
          </dt>
          {entry.times.map((time) => (
            <dd key={time.days} className="mt-1 flex justify-between gap-4">
              <span className="text-ink-muted">{time.days}</span>
              <span>{time.hours}</span>
            </dd>
          ))}
        </div>
      ))}
    </dl>
  );
}
