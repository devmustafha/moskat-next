import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHeader } from "@/components/ui/page-header";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: `How ${siteConfig.name} uses the details you give when booking an online consultation.`,
};

// Placeholder text describing how the booking system actually handles data. Have it reviewed
// by the hospital's data protection lead before launch.
export default function PrivacyPage() {
  const { booking, contact } = siteConfig;
  const sections = [
    {
      title: "What we collect when you book online",
      body: [
        "Your name, email address and, if you choose to give it, a phone number. We also record when you agreed to this notice.",
        "We don’t ask for your date of birth, address or any medical information when you book. Your doctor will ask about your health during the consultation.",
      ],
    },
    {
      title: "How we use it",
      body: [
        "Only to arrange your consultation: to confirm the booking, send you the video link and payment details, and contact you if something changes.",
        "We don’t use your details for marketing, and we don’t sell or share them.",
      ],
    },
    {
      title: "How we protect it",
      body: [
        "Your booking is stored in an encrypted database that only the booking system and authorised staff can access.",
        "You manage your booking through a private link that only you receive. Keep it private: anyone with the link can view and cancel the booking.",
      ],
    },
    {
      title: "How long we keep it",
      body: [
        `We delete your name, email and phone number from the booking ${booking.piiRetentionDays} days after your appointment, or ${booking.piiRetentionDays} days after you cancel. We keep an anonymous record of the appointment time for scheduling.`,
        "Anything recorded during your consultation becomes part of your medical record, which is covered by the hospital’s main privacy policy.",
      ],
    },
    {
      title: "If you create an account",
      body: [
        "An account is optional. It stores your name, email address and an encrypted form of your password, and lets you see the bookings you make while signed in.",
        `While you’re signed in we keep a record of your sign-in, including your IP address and browser. You’re signed out after ${siteConfig.auth.idleTimeoutHours} hours without activity, and always after ${siteConfig.auth.absoluteLifetimeHours} hours.`,
      ],
    },
    {
      title: "Your choices",
      body: [
        `You can cancel online until ${booking.cancelUntilHours} hours before your appointment. To see, correct or delete your details sooner, email ${contact.email.label} or call ${contact.phone.label}.`,
      ],
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Privacy"
        title={
          <>
            Booking privacy notice. <span className="text-ink-subtle">The short version.</span>
          </>
        }
        description="What happens to the details you give us when you book a video consultation."
      />
      <section aria-label="Privacy notice" className="pb-section">
        <Container>
          <div className="max-w-copy space-y-10">
            {sections.map((section) => (
              <div key={section.title}>
                <h2 className="text-h3">{section.title}</h2>
                <div className="mt-3 space-y-3 text-body text-ink-muted">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
