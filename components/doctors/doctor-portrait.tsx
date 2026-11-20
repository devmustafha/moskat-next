import { Photo } from "@/components/ui/photo";
import type { Doctor } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type DoctorPortraitProps = {
  doctor: Doctor;
  sizes: string;
  priority?: boolean;
  className?: string;
};

function initials(name: string) {
  return name
    .replace(/^Dr\.?\s+/, "")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

/**
 * The doctor's photo in a 4:5 frame, or their initials on a brand tint until a photo is added.
 * The parent sets any hover effect via `className` on the frame's image.
 */
export function DoctorPortrait({ doctor, sizes, priority, className }: DoctorPortraitProps) {
  return (
    <div className="aspect-[4/5] overflow-hidden rounded-card bg-surface">
      {doctor.photo ? (
        <Photo image={doctor.photo} focus="faces" sizes={sizes} priority={priority} className={className} />
      ) : (
        <div
          role="img"
          aria-label={`Portrait placeholder for ${doctor.name}`}
          className={cn("grid h-full w-full place-items-center bg-brand-100", className)}
        >
          <span aria-hidden="true" className="text-h1 text-brand-700">
            {initials(doctor.name)}
          </span>
        </div>
      )}
    </div>
  );
}
