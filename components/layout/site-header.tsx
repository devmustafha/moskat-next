import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { safeErrorSummary } from "@/lib/db/errors";
import { initialsOf } from "@/lib/format";
import { siteConfig } from "@/lib/site";
import { MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-links";
import { UserMenu, type UserMenuProps } from "./user-menu";

/** The signed-in person's own pages, by role, for the avatar menu. */
function accountMenu(user: SessionUser): UserMenuProps {
  const base = { name: user.name, email: user.email, initials: initialsOf(user.name) };
  switch (user.role) {
    case "doctor":
      return {
        ...base,
        roleLabel: "Doctor",
        links: [
          { label: "Consultation queue", href: "/doctor/queue" },
          { label: "Your doctor profile", href: "/doctor/profile" },
          { label: "Account settings", href: "/account" },
        ],
      };
    case "admin":
      return {
        ...base,
        roleLabel: "Admin",
        links: [
          { label: "Hospital admin", href: "/admin/bookings" },
          { label: "Account settings", href: "/account" },
        ],
      };
    default:
      return {
        ...base,
        links: [
          { label: "Your profile", href: "/account" },
          { label: "Your bookings", href: "/account/bookings" },
        ],
      };
  }
}

/**
 * Who the header is for: signed out, signed in (with their menu), or "unknown" when the session
 * couldn't be read (a database hiccup), so a public page still renders.
 */
async function headerSession(): Promise<{ state: "signed-out" } | { state: "signed-in"; menu: UserMenuProps } | { state: "unknown" }> {
  // Signed-out visitors cost nothing: without a session cookie there's no database lookup. With
  // one, the session is read once per request (getSession is cached, so a page's own require*
  // guard reuses it); an expired or revoked session shows "Sign in" again.
  if (!getSessionCookie(await headers(), { cookiePrefix: "moskat" })) return { state: "signed-out" };
  try {
    const user = await getSession();
    return user ? { state: "signed-in", menu: accountMenu(user) } : { state: "signed-out" };
  } catch (error) {
    unstable_rethrow(error); // Next's own control flow (dynamic rendering, redirects) passes through.
    console.error(`header: couldn't read the session: ${safeErrorSummary(error)}`);
    return { state: "unknown" };
  }
}

export async function SiteHeader() {
  const session = await headerSession();
  const menu = session.state === "signed-in" ? session.menu : null;

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
          {session.state === "signed-out" && (
            <Link href="/sign-in" className="nav-link hidden lg:inline-flex">
              Sign in
            </Link>
          )}
          {session.state === "unknown" && (
            <Link href="/account" className="nav-link">
              Your account
            </Link>
          )}
          <ButtonLink href={siteConfig.bookingHref} size="sm" className="hidden sm:inline-flex">
            Book an online consultation
          </ButtonLink>
          {menu && <UserMenu {...menu} />}
          <MobileMenu links={siteConfig.nav} signIn={session.state === "signed-out"} bookingHref={siteConfig.bookingHref} />
        </div>
      </Container>
    </header>
  );
}
