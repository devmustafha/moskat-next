/**
 * Frequently asked questions, grouped by topic. Answers are plain text; keep them short.
 * Placeholders: check every answer against the hospital's real policies before launch.
 */
export type Faq = { question: string; answer: string };
export type FaqGroup = { id: string; title: string; faqs: Faq[] };

export const faqGroups: FaqGroup[] = [
  {
    id: "online-consultations",
    title: "Online consultations",
    faqs: [
      {
        question: "Can I use an online consultation in an emergency?",
        answer:
          "No. Online consultations are for non-urgent advice only. If you or someone else has chest pain, difficulty breathing, severe bleeding, signs of a stroke, or is unconscious, call your local emergency number or our 24-hour emergency line straight away.",
      },
      {
        question: "What can a video consultation help with?",
        answer:
          "Video visits suit advice about new or ongoing symptoms, follow-ups, discussing test results and repeat prescriptions. If your doctor needs to examine you, they’ll arrange an in-person appointment.",
      },
      {
        question: "What do I need for a video consultation?",
        answer:
          "A phone, tablet or computer with a camera, a stable internet connection and a quiet, private space. You join from the link in your confirmation email; there’s no app to install.",
      },
      {
        question: "Can my doctor prescribe medicine online?",
        answer:
          "Yes, where it’s safe to do so. Prescriptions are sent electronically to the pharmacy of your choice. Some medicines can only be prescribed after an in-person examination.",
      },
    ],
  },
  {
    id: "booking-payment",
    title: "Booking and payment",
    faqs: [
      {
        question: "How do I book an appointment?",
        answer:
          "Choose a doctor from our directory, sign in or create a free patient account, pick a time and pay online with Paystack to book a video consultation. To book an in-person appointment, call us. You don’t need a referral for most specialist appointments.",
      },
      {
        question: "How much does a consultation cost?",
        answer:
          "Every doctor’s video consultation fee is shown on their profile before you book. In-person consultations, tests and health checks are listed on our pricing page.",
      },
      {
        question: "Can I cancel or change my appointment?",
        answer:
          "Yes. Cancel from your account up to 2 hours before your appointment and we’ll refund your payment in full, then book a new time. For later changes, call us.",
      },
      {
        question: "Do you accept insurance?",
        answer:
          "We work with most major insurers. Bring your policy details and we’ll confirm your cover before any treatment begins.",
      },
    ],
  },
  {
    id: "visiting",
    title: "Visiting the hospital",
    faqs: [
      {
        question: "Is there parking?",
        answer: "Yes. Free parking is available on site, with accessible bays next to every entrance.",
      },
      {
        question: "Is the hospital accessible?",
        answer:
          "All buildings have step-free access, lifts and accessible toilets. Wheelchairs are available at main reception. Let us know when you book if you need any other support.",
      },
      {
        question: "Can someone come with me?",
        answer:
          "Yes. You’re welcome to bring a relative, friend or carer to any appointment, including video consultations.",
      },
    ],
  },
  {
    id: "records-privacy",
    title: "Records and privacy",
    faqs: [
      {
        question: "How do I get my test results?",
        answer:
          "Your doctor reviews every result first, then you can see it in your patient account. If anything needs action, we’ll contact you.",
      },
      {
        question: "Are video consultations private?",
        answer:
          "Yes. Video calls are encrypted and never recorded. Your doctor joins from a private room, and only the people you invite can join.",
      },
    ],
  },
];
