/**
 * Sample self-pay prices in kobo (minor units of the site currency, NGN), like every amount on the
 * site. All figures are placeholders: replace them with the hospital's approved price list before
 * launch. Online consultation fees live on each doctor in the database.
 */
export type PriceItem = {
  name: string;
  detail: string;
  /** Price in kobo; shown as "from" when `from` is true. */
  price: number;
  from?: boolean;
};

export type PriceGroup = {
  id: string;
  title: string;
  description: string;
  items: PriceItem[];
};

export const priceGroups: PriceGroup[] = [
  {
    id: "in-person",
    title: "In-person consultations",
    description: "A specialist appointment at the hospital, including examination and a written plan.",
    items: [
      { name: "New patient consultation", detail: "45 minutes with a specialist", price: 4_500_000 },
      { name: "Follow-up consultation", detail: "20–30 minutes, within 6 months of your first visit", price: 3_000_000 },
      { name: "Paediatric consultation", detail: "Children under 18, 30 minutes", price: 3_500_000 },
    ],
  },
  {
    id: "diagnostics",
    title: "Tests and imaging",
    description: "Prices include the test and a specialist’s report. Your doctor will explain the results.",
    items: [
      { name: "Full blood count", detail: "Results usually the same day", price: 800_000 },
      { name: "Cholesterol & blood sugar panel", detail: "Fasting test, results within 24 hours", price: 1_500_000 },
      { name: "ECG", detail: "Heart rhythm recording, read by a cardiologist", price: 1_200_000 },
      { name: "X-ray", detail: "Per body area, walk-in", price: 1_800_000, from: true },
      { name: "Ultrasound scan", detail: "Abdominal, pelvic or pregnancy", price: 2_500_000, from: true },
      { name: "MRI scan", detail: "Per body area, by appointment", price: 25_000_000, from: true },
    ],
  },
];

export type HealthCheck = {
  name: string;
  price: number;
  summary: string;
  includes: string[];
  /** Highlight one package as the recommended choice. */
  featured?: boolean;
};

export const healthChecks: HealthCheck[] = [
  {
    name: "Essential",
    price: 6_000_000,
    summary: "A yearly check of the basics for healthy adults.",
    includes: ["Doctor consultation", "Blood pressure & BMI", "Full blood count", "Cholesterol & blood sugar"],
  },
  {
    name: "Comprehensive",
    price: 15_000_000,
    summary: "A thorough review for adults over 40 or with a family history.",
    includes: [
      "Everything in Essential",
      "Kidney, liver & thyroid tests",
      "ECG",
      "Abdominal ultrasound",
      "Follow-up video consultation",
    ],
    featured: true,
  },
  {
    name: "Heart health",
    price: 12_000_000,
    summary: "A focused check for people concerned about heart disease.",
    includes: ["Cardiologist consultation", "ECG", "Echocardiogram", "Cholesterol & blood sugar"],
  },
];

export const paymentNotes = [
  {
    title: "Pay before your video visit",
    text: "Bookings are confirmed straight away. Our patient team sends payment details before your appointment, and if your doctor needs to cancel, you aren’t charged.",
  },
  {
    title: "Insurance",
    text: "We work with most major insurers. Bring your policy details and we’ll check your cover before any treatment.",
  },
  {
    title: "No surprise bills",
    text: "If your doctor recommends further tests, you’ll see the price and agree to it before anything is done.",
  },
];
