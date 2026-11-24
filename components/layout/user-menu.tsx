"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

export type UserMenuProps = {
  name: string;
  email: string;
  initials: string;
  /** "Doctor" or "Admin"; none for patients. */
  roleLabel?: string;
  /** The signed-in person's own pages, for their role (built in site-header.tsx). */
  links: readonly { label: string; href: string }[];
};

/**
 * The signed-in person's avatar in the header (desktop and mobile), opening a small panel with
 * their name, their own pages and "Sign out". A disclosure (button + panel), closed by Escape, a
 * click outside or choosing a link.
 */
export function UserMenu({ name, email, initials, roleLabel, links }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut().catch(() => {});
    // A full load, so the header and any signed-in page are rendered again without the session.
    window.location.assign("/");
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "grid size-11 place-items-center rounded-full bg-brand-600 text-small font-medium text-white transition-shadow duration-200 ease-out-soft",
          "hover:ring-4 hover:ring-brand-50 aria-expanded:ring-4 aria-expanded:ring-brand-50",
        )}
      >
        <span aria-hidden="true">{initials}</span>
        <span className="sr-only">{open ? "Close your account menu" : `Your account menu (${name})`}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-card border bg-canvas p-2 shadow-soft"
      >
        <div className="flex items-center gap-3 border-b px-3 pt-2 pb-4">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-small font-medium text-brand-700">
            {initials}
          </span>
          <span className="grid min-w-0">
            <span className="truncate text-small font-medium text-ink">{name}</span>
            <span className="truncate text-caption text-ink-muted">{roleLabel ? `${roleLabel} · ${email}` : email}</span>
          </span>
        </div>
        <ul className="grid gap-0.5 py-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                className="block rounded-field px-3 py-2.5 text-small text-ink transition-colors hover:bg-surface"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t pt-2">
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-field px-3 py-2.5 text-left text-small text-ink transition-colors hover:bg-surface disabled:opacity-60"
          >
            <LogOut aria-hidden="true" className="size-4" strokeWidth={2} />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
