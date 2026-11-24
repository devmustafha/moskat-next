"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { NavLink } from "./nav-links";

type MobileMenuProps = {
  links: readonly { label: string; href: string }[];
  /** Signed out: end the list with "Sign in". (Signed in, the avatar beside this button has the account links.) */
  signIn: boolean;
  bookingHref: string;
};

/**
 * Disclosure menu for screens below the desktop breakpoint. Closed by Escape, choosing a link,
 * or a click outside it (e.g. on the avatar menu next to it).
 */
export function MobileMenu({ links, signIn, bookingHref }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
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

  const items = signIn ? [...links, { label: "Sign in", href: "/sign-in" }] : links;

  return (
    <div ref={root} className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="grid size-11 place-items-center rounded-full bg-surface text-ink transition-colors hover:bg-surface-strong"
      >
        {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 border-b bg-canvas px-gutter pt-2 pb-6 shadow-soft"
      >
        <nav aria-label="Main">
          <ul className="divide-y">
            {items.map((link) => (
              <li key={link.href}>
                <NavLink
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-4 text-h4 font-normal aria-[current=page]:text-brand-700"
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <ButtonLink href={bookingHref} onClick={() => setOpen(false)} className="mt-4 w-full justify-between">
          Book an online consultation
        </ButtonLink>
      </div>
    </div>
  );
}
