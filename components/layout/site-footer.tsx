import Link from "next/link";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/site";

export function SiteFooter() {
  const { contact } = siteConfig;
  return (
    <footer className="bg-ink text-white">
      <Container size="wide" className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-[1.2fr_1.6fr_1fr_1.1fr]">
        <div>
          <p className="flex items-center gap-2.5 text-h4 font-medium">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-brand-500">
              <span className="size-2.5 rounded-full bg-white" />
            </span>
            {siteConfig.name}
          </p>
          <p className="mt-4 max-w-xs text-small text-white/70">{siteConfig.description}</p>
          <p className="mt-6 text-small">
            <span className="text-white/70">Emergency, 24/7: </span>
            <a href={contact.emergencyPhone.href} className="font-semibold underline underline-offset-2 hover:no-underline">
              {contact.emergencyPhone.label}
            </a>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <nav aria-labelledby="footer-explore">
            <h2 id="footer-explore" className="text-eyebrow uppercase text-white/60">
              Explore
            </h2>
            <ul className="mt-5 space-y-3 text-small">
              <li>
                <Link href="/" className="text-white/85 transition-colors hover:text-white">
                  Home
                </Link>
              </li>
              {siteConfig.nav.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/85 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-patients">
            <h2 id="footer-patients" className="text-eyebrow uppercase text-white/60">
              Patients
            </h2>
            <ul className="mt-5 space-y-3 text-small">
              {siteConfig.patientNav.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/85 transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div>
          <h2 className="text-eyebrow uppercase text-white/60">Contact</h2>
          <address className="mt-5 space-y-3 text-small not-italic text-white/85">
            <p>
              {contact.address[0]}
              <br />
              {contact.address[1]}
            </p>
            <p>
              <a href={contact.phone.href} className="hover:text-white">
                {contact.phone.label}
              </a>
            </p>
            <p>
              <a href={contact.email.href} className="hover:text-white">
                {contact.email.label}
              </a>
            </p>
          </address>
        </div>

        <div>
          <h2 className="text-eyebrow uppercase text-white/60">Opening hours</h2>
          <dl className="mt-5 space-y-3 text-small">
            {siteConfig.hours.map((entry) => (
              <div key={entry.service}>
                <dt className="text-white/60">{entry.service}</dt>
                {entry.times.map((time) => (
                  <dd key={time.days} className="text-white/85">
                    {time.days}: {time.hours}
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        </div>
      </Container>

      <Container
        size="wide"
        className="flex flex-col gap-2 border-t border-white/15 py-6 text-caption text-white/60 sm:flex-row sm:justify-between"
      >
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
        <p>Photography from Unsplash.</p>
      </Container>
    </footer>
  );
}
