import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

/** Narrow centred layout for the sign-in and sign-up pages. */
export function AuthPage({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer: ReactNode }) {
  return (
    <Container className="py-12 md:py-20">
      <div className="mx-auto grid max-w-md gap-6">
        <div>
          <h1 className="text-h2">{title}</h1>
          <p className="mt-3 text-small text-ink-muted">{description}</p>
        </div>
        <Card>{children}</Card>
        <p className="text-small text-ink-muted">{footer}</p>
      </div>
    </Container>
  );
}
