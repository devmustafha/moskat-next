import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/site";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-links";

export async function SiteHeader() {
  // Cookie presence only (no database lookup), so the header costs nothing on public pages.
  // /account checks the session properly and sends signed-out visitors to sign in.
  const signedIn = Boolean(getSessionCookie(await headers(), { cookiePrefix: "moskat" }));
  const account = signedIn ? { label: "Your account", href: "/account" } : { label: "Sign in", href: "/sign-in" };

  return (
    <header className="relative bg-canvas">
      <Container size="wide" className="flex h-18 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 text-h4 font-medium">
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-brand-600">
            <span className="size-2.5 rounded-full bg-white" />
          </span>
          {siteConfig.name}
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1 rounded-full bg-surface p-1">
            {siteConfig.nav.map((link) => (
              <li key={link.href}>
                <NavLink href={link.href} className="nav-link aria-[current=page]:bg-canvas">
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link href={account.href} className="nav-link hidden lg:inline-flex">
            {account.label}
          </Link>
          <ButtonLink href={siteConfig.bookingHref} size="sm" className="hidden sm:inline-flex">
            Book an online consultation
          </ButtonLink>
          <MobileMenu links={siteConfig.nav} account={account} bookingHref={siteConfig.bookingHref} />
        </div>
      </Container>
    </header>
  );
}
