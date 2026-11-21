/**
 * Central site metadata, contact details and opening hours.
 * Contact details below are placeholders (555-01xx numbers and a .example domain are reserved
 * for fiction); replace them with the hospital's real details before launch.
 */
export const siteConfig = {
  name: "Moskat",
  tagline: "Hospital & online care",
  description: "Specialist hospital care in person and online, from a team that takes time to listen.",
  locale: "en-NG",
  /** Paystack charges in NGN; every amount is integer kobo (minor units). */
  currency: "NGN",
  /** Hospital time zone: the default for doctors' weekly hours and for displaying times. */
  timeZone: "Africa/Lagos",

  booking: {
    /**
     * Every consultation's length, for every doctor. The database requires the same value
     * (doctors_minutes_check, migration 0013): change both together, in a new migration.
     */
    consultationMinutes: 30,
    /** Earliest bookable slot, in minutes from now. */
    leadTimeMinutes: 5,
    /** How far ahead patients can book, in days. */
    horizonDays: 28,
    /** Patients can cancel online until this many hours before the start. */
    cancelUntilHours: 2,
    /** Patient details are cleared this many days after the appointment (or cancellation). */
    piiRetentionDays: 90,
    /** Booking attempts per minute per visitor (IP address). */
    attemptsPerMinute: 5,
    /** An unpaid booking holds its slot this long while the patient pays; then the slot is released. */
    paymentHoldMinutes: 30,
    /** What patients are told about refunds of cancelled paid bookings. */
    refundBusinessDays: 10,
  },

  /** Video calls (Agora). Tokens are only issued inside this window around the appointment. */
  consultation: {
    /** The call opens this long before the start. */
    joinOpensMinutesBefore: 10,
    /** A first join is refused this long after the start (someone who joined can still reconnect). */
    lateJoinMinutesAfterStart: 30,
    /** Hard stop: no token, renewal or reconnect after the scheduled end plus this. */
    graceMinutesAfterEnd: 15,
    /** Lifetime of each Agora token (and its privileges); the call renews it before it expires. */
    tokenTtlSeconds: 600,
    /** Token requests (joins and renewals) per minute per signed-in user. */
    tokenRequestsPerMinute: 10,
  },

  auth: {
    /** Signed out after this long without activity (Better Auth `session.expiresIn`). */
    idleTimeoutHours: 2,
    /** Signed out this long after signing in, however active (checked in lib/auth/session.ts). */
    absoluteLifetimeHours: 12,
    /** How often an active session's expiry is pushed back (`session.updateAge`). */
    refreshMinutes: 15,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    /** Sign-in, sign-up and password-change attempts per minute per visitor (IP address). */
    attemptsPerMinute: 10,
  },

  email: {
    /** Sender for booking emails. Must be on a domain verified in Resend (lib/email/resend.ts). */
    from: { name: "Moskat bookings", email: "bookings@moskat.example" },
  },

  /** Where every "Book an online consultation" call to action points: patients choose a doctor first. */
  bookingHref: "/doctors",

  contact: {
    phone: { label: "+1 (555) 010-0123", href: "tel:+15550100123" },
    emergencyPhone: { label: "+1 (555) 010-0100", href: "tel:+15550100100" },
    /** Shown next to the hospital's emergency line; the public number for ambulances. */
    publicEmergency: { label: "911", href: "tel:911" },
    email: { label: "hello@moskat.example", href: "mailto:hello@moskat.example" },
    address: ["120 Riverside Avenue", "Springfield, ST 01234"],
    directionsHref: "https://www.google.com/maps/search/?api=1&query=120+Riverside+Avenue+Springfield",
    /** Google Maps embed (no API key needed). Replace the query with the real address. */
    mapEmbedSrc: "https://www.google.com/maps?q=120+Riverside+Avenue+Springfield&output=embed",
  },

  hours: [
    { service: "Emergency department", times: [{ days: "Every day", hours: "Open 24 hours" }], emergency: true },
    {
      service: "Outpatient clinics",
      times: [
        { days: "Monday – Friday", hours: "8:00 am – 6:00 pm" },
        { days: "Saturday", hours: "9:00 am – 2:00 pm" },
        { days: "Sunday", hours: "Closed" },
      ],
    },
    { service: "Online consultations", times: [{ days: "Every day", hours: "7:00 am – 10:00 pm" }] },
  ],

  /** Main navigation (header). The logo links home. */
  nav: [
    { label: "About", href: "/about" },
    { label: "Departments", href: "/departments" },
    { label: "Doctors", href: "/doctors" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
  ],

  /** Secondary links, shown in the footer alongside the main navigation. */
  patientNav: [
    { label: "Book an online consultation", href: "/doctors" },
    { label: "Frequently asked questions", href: "/faq" },
    { label: "Health articles", href: "/articles" },
    { label: "Opening hours", href: "/contact#hours" },
    { label: "Booking privacy notice", href: "/privacy" },
  ],
} as const;
