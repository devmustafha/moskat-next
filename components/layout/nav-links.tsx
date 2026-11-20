"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

/** True when `pathname` is `href` or one of its child pages (e.g. /doctors/amara-okafor for /doctors). */
export function isCurrent(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A navigation link that sets aria-current="page" on the current section. */
export function NavLink({ href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const pathname = usePathname();
  return <Link href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined} {...props} />;
}
