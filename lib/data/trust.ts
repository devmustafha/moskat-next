/**
 * Sample trust signals for the homepage. All figures, testimonials and accreditations are
 * placeholders: replace them with verified, real information before launch.
 */
export const stats = [
  { value: "30+", label: "Years caring for our community" },
  { value: "120", label: "Specialist doctors and surgeons" },
  { value: "48k", label: "Patients treated last year" },
  { value: "4.9/5", label: "Average rating from 2,300 reviews" },
];

export type Testimonial = {
  quote: string;
  name: string;
  context: string;
};

/** The first testimonial is featured. */
export const testimonials: Testimonial[] = [
  {
    quote:
      "Our son had a fever late at night. We booked a video consultation in minutes and had clear advice before bedtime.",
    name: "Tomás R.",
    context: "Parent, online consultation",
  },
  {
    quote:
      "The cardiology team explained every result in plain language. I never felt rushed, and the follow-up call a week later meant a lot.",
    name: "Grace A.",
    context: "Cardiology patient",
  },
  {
    quote:
      "From the first scan to delivery day, the women’s health team was calm, kind and always available to answer questions.",
    name: "Nadia K.",
    context: "Antenatal care",
  },
];

export type AccreditationIcon = "shield-check" | "award" | "badge-check" | "lock";

export const accreditations: { icon: AccreditationIcon; title: string; detail: string }[] = [
  { icon: "shield-check", title: "Nationally accredited", detail: "Hospital accreditation standard" },
  { icon: "award", title: "ISO 9001 certified", detail: "Quality management" },
  { icon: "badge-check", title: "Registered specialists", detail: "Licensed by the medical council" },
  { icon: "lock", title: "Private video visits", detail: "End-to-end encrypted" },
];
