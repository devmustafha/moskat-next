"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { NavLink } from "./nav-links";

type MobileMenuProps = {
  links: readonly { label: string; href: string }[];
  /** "Sign in" or "Your account". */
  account: { label: string; href: string };
  bookingHref: string;
};

/** Disclosure menu for screens below the desktop breakpoint. */
export function MobileMenu({ links, account, bookingHref }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
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
            {[...links, account].map((link) => (
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
