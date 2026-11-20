import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmergencyNotice } from "@/components/shared/emergency-notice";
import { Card } from "@/components/ui/card";
import { Container, Section } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Grid } from "@/components/ui/grid";

// Development-only reference for the design system. Returns 404 in production builds.
export const metadata: Metadata = { title: "Style guide", robots: { index: false } };

const swatches = [
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["surface-strong", "bg-surface-strong"],
  ["line", "bg-line"],
  ["line-strong", "bg-line-strong"],
  ["ink-subtle", "bg-ink-subtle"],
  ["ink-muted", "bg-ink-muted"],
  ["ink", "bg-ink"],
  ["brand-50", "bg-brand-50"],
  ["brand-100", "bg-brand-100"],
  ["brand-300", "bg-brand-300"],
  ["brand-500", "bg-brand-500"],
  ["brand-600", "bg-brand-600"],
  ["brand-700", "bg-brand-700"],
  ["brand-900", "bg-brand-900"],
] as const;

const typeScale = [
  ["text-display", "Care"],
  ["text-h1", "Heading one"],
  ["text-h2", "Heading two"],
  ["text-h3", "Heading three"],
  ["text-h4", "Heading four"],
  ["text-lead", "Lead paragraph for section introductions."],
  ["text-body", "Body text for product descriptions and longer copy."],
  ["text-small", "Small text for card copy, buttons and navigation."],
  ["text-caption", "Caption text for labels and meta."],
] as const;

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <Section>
        <Eyebrow>Design system</Eyebrow>
        <h1 className="mt-6 text-h1">
          Style guide <span className="text-ink-subtle">for every page.</span>
        </h1>
        <p className="mt-6 max-w-copy text-lead text-ink-muted">
          Tokens live in <code>app/globals.css</code>; components live in <code>components/ui/</code>.
          Read more in the <a className="link" href="#type">type scale</a>.
        </p>
      </Section>

      <Section tone="surface">
        <h2 className="text-h2">Colour</h2>
        <div className="mt-10 grid grid-cols-3 gap-4 sm:grid-cols-5">
          {swatches.map(([name, bg]) => (
            <div key={name}>
              <div className={`h-16 rounded-field border ${bg}`} />
              <p className="mt-2 text-caption text-ink-muted">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type">
        <h2 className="text-h2">Type scale</h2>
        <div className="mt-10 divide-y">
          {typeScale.map(([token, sample]) => (
            <div key={token} className="grid gap-2 py-5 md:grid-cols-[10rem_1fr] md:items-baseline">
              <p className="text-caption text-ink-muted">{token}</p>
              <p className={`${token} overflow-hidden`}>{sample}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="surface">
        <h2 className="text-h2">Buttons</h2>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="brand">Add to cart</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="alert" withIcon={false}>
            Emergency call only
          </Button>
          <Button size="sm">Small</Button>
          <Button variant="outline" withIcon={false}>
            No icon
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-card bg-ink p-6">
          <Eyebrow tone="inverse">On dark</Eyebrow>
          <Button variant="inverse">Inverse</Button>
        </div>
      </Section>

      <Section>
        <h2 className="text-h2">Cards &amp; grid</h2>
        <Grid cols={3} className="mt-10">
          <Card>
            <p className="text-eyebrow uppercase text-ink-muted">Default</p>
            <p className="mt-4 text-h3">Hairline card</p>
            <p className="mt-2 text-small text-ink-muted">White surface with a 1px border.</p>
          </Card>
          <Card tone="brand">
            <p className="text-eyebrow uppercase text-white/80">Brand</p>
            <p className="mt-4 text-h3">Highlighted item</p>
            <p className="mt-2 text-small text-white/80">One per group, at most.</p>
          </Card>
          <Card tone="muted">
            <p className="text-eyebrow uppercase text-ink-muted">Muted</p>
            <p className="mt-4 text-h3">Grey card</p>
            <p className="mt-2 text-small text-ink-muted">For use on white sections.</p>
          </Card>
        </Grid>
      </Section>

      <Section tone="surface">
        <h2 className="text-h2">Emergency notice</h2>
        <p className="mt-4 max-w-copy text-small text-ink-muted">
          <code>components/shared/emergency-notice.tsx</code>. Use the panel wherever someone can book online; the
          inline version suits cards and sidebars.
        </p>
        <EmergencyNotice className="mt-10" />
        <EmergencyNotice variant="inline" className="mt-6 max-w-xl" />
      </Section>

      <Section>
        <h2 className="text-h2">Form fields</h2>
        <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-caption font-medium">
            Full name
            <input className="field" placeholder="Your name" />
          </label>
          <label className="grid gap-2 text-caption font-medium">
            Email
            <input className="field" type="email" placeholder="you@example.com" />
          </label>
        </div>
      </Section>

      <section className="py-section">
        <Container size="bleed">
          <div className="relative overflow-hidden rounded-panel bg-linear-to-br from-brand-700 to-brand-900 p-8 text-white md:p-14">
            <div className="scrim absolute inset-0" aria-hidden="true" />
            <div className="relative">
              <Eyebrow tone="inverse">Media panel</Eyebrow>
              <p className="mt-6 text-display">Care</p>
              <Card tone="glass" className="mt-8 max-w-sm">
                <p className="text-h4">Glass panel over imagery, with a scrim for legibility.</p>
              </Card>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
