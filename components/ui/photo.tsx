import type { ComponentProps } from "react";
import type { ImageAsset } from "@/lib/images";
import { cn } from "@/lib/utils";

const WIDTHS = [320, 480, 640, 800, 1080, 1280, 1600, 1920];

type PhotoProps = Omit<ComponentProps<"img">, "src" | "srcSet" | "width" | "height" | "alt"> & {
  image: ImageAsset;
  /** Rendered width hints for the browser, e.g. "(min-width: 75rem) 50vw, 100vw". */
  sizes: string;
  /** Load eagerly with high priority (use for the main above-the-fold image only). */
  priority?: boolean;
  /** Crop focus on the CDN: keep faces in frame for portraits. */
  focus?: "center" | "faces";
  /** Purely decorative (e.g. avatars next to text that already names the people): empty alt. */
  decorative?: boolean;
};

function imageUrl(image: ImageAsset, width: number, focus: PhotoProps["focus"]) {
  const url = new URL(image.src);
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", "crop");
  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(Math.round((width * image.height) / image.width)));
  url.searchParams.set("q", "70");
  if (focus === "faces") url.searchParams.set("crop", "faces");
  return url.toString();
}

/**
 * Responsive photo from the Unsplash CDN. The CDN resizes and crops to the asset's aspect
 * ratio; `srcset` lets the browser pick the smallest file that fits.
 */
export function Photo({
  image,
  sizes,
  priority = false,
  focus = "center",
  decorative = false,
  className,
  ...props
}: PhotoProps) {
  const widths = WIDTHS.filter((w) => w <= image.width * 1.6);
  return (
    <img
      src={imageUrl(image, Math.min(800, image.width), focus)}
      srcSet={widths.map((w) => `${imageUrl(image, w, focus)} ${w}w`).join(", ")}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={decorative ? "" : image.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn("h-full w-full object-cover", className)}
      {...props}
    />
  );
}
