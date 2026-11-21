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
        "Only to arrange your consultation: to confirm the booking, take payment, run the video call, and contact you if something changes.",
        "We don’t use your details for marketing, and we don’t sell them.",
      ],
    },
    {
      title: "Payments",
      body: [
        "Payments are processed by Paystack. We send Paystack your email address, the amount and a booking reference, and you enter your card or bank details on Paystack’s page, never on ours. Paystack emails you a receipt.",
        "We don’t tell Paystack which doctor or department your appointment is with. We keep a record of each payment (amount, status and Paystack reference) for our accounts and for refunds.",
      ],
    },
    {
      title: "How we protect it",
      body: [
        "Your booking is stored in an encrypted database that only the booking system and authorised staff can access.",
        "Online bookings are linked to your patient account, so only you can see or cancel them once you’ve signed in. Bookings made before accounts were needed can still be managed through their private link; keep that link private.",
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
        "You need an account to book and pay for a video consultation online. It stores your name, email address and an encrypted form of your password, and shows the bookings you make.",
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
