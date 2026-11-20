/**
 * Sample health articles. Content is general information, not medical advice; have every
 * article reviewed by a clinician before launch. Authors are doctor slugs from the database (see lib/db/seed-data.ts).
 */
export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] };

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  /** Slug of the authoring doctor. */
  author: string;
  /** ISO date (YYYY-MM-DD). */
  published: string;
  readMinutes: number;
  body: ArticleBlock[];
};

export const articles: Article[] = [
  {
    slug: "when-to-use-a-video-consultation",
    title: "When a video consultation is the right choice, and when it isn’t",
    excerpt:
      "Video visits are quick and convenient, but they aren’t for everything. Here’s how to decide between a video call, an in-person visit and emergency care.",
    category: "Using our services",
    author: "elena-ruiz",
    published: "2026-11-04",
    readMinutes: 4,
    body: [
      {
        type: "paragraph",
        text: "A video consultation lets you speak to a specialist from home, often on the same day. For many questions it’s all you need. But some problems need a doctor to examine you in person, and a few need emergency care straight away.",
      },
      { type: "heading", text: "Good reasons to book a video visit" },
      {
        type: "list",
        items: [
          "Advice about a new symptom that isn’t severe or getting rapidly worse",
          "Follow-up after a hospital appointment or treatment",
          "Going through test results with your doctor",
          "Reviewing medicines or requesting a repeat prescription",
          "Questions about a long-term condition such as asthma or high blood pressure",
        ],
      },
      { type: "heading", text: "When to come in person" },
      {
        type: "paragraph",
        text: "If your doctor needs to listen to your chest, feel your abdomen, check a joint or run a test, they’ll arrange an in-person appointment. A video call is still a good first step: your doctor can often order the right tests so they’re ready when you arrive.",
      },
      { type: "heading", text: "When to call for emergency help instead" },
      {
        type: "paragraph",
        text: "Never wait for a video appointment in an emergency. Call your local emergency number or our 24-hour emergency line if you or someone else has:",
      },
      {
        type: "list",
        items: [
          "Chest pain or pressure, especially if it spreads to the arm, jaw or back",
          "Difficulty breathing or choking",
          "Signs of a stroke: a drooping face, weak arm or slurred speech",
          "Severe bleeding that won’t stop",
          "A seizure, collapse or loss of consciousness",
          "A child who is floppy, unusually drowsy or hard to wake",
        ],
      },
    ],
  },
  {
    slug: "understanding-blood-pressure",
    title: "Understanding your blood pressure numbers",
    excerpt:
      "What the two numbers mean, what counts as high, and simple steps that make a real difference.",
    category: "Heart health",
    author: "arjun-mehta",
    published: "2026-10-21",
    readMinutes: 5,
    body: [
      {
        type: "paragraph",
        text: "High blood pressure rarely causes symptoms, which is why it’s often called a silent condition. Knowing your numbers is the first step to protecting your heart, brain and kidneys.",
      },
      { type: "heading", text: "What the numbers mean" },
      {
        type: "paragraph",
        text: "A reading such as 120/80 has two parts. The top number (systolic) is the pressure when your heart beats; the bottom number (diastolic) is the pressure between beats. Both matter.",
      },
      {
        type: "paragraph",
        text: "Under current US guidelines, readings consistently at or above 130/80 are considered high. A single high reading isn’t a diagnosis: your doctor will look at several readings, ideally including some taken at home.",
      },
      { type: "heading", text: "Taking an accurate reading at home" },
      {
        type: "list",
        items: [
          "Sit quietly for five minutes first, with your back supported and feet flat",
          "Rest your arm at heart level and use the right cuff size",
          "Avoid caffeine, exercise and smoking for 30 minutes beforehand",
          "Take two readings a minute apart and write both down",
        ],
      },
      { type: "heading", text: "Changes that help" },
      {
        type: "paragraph",
        text: "Eating less salt, staying active, keeping to a healthy weight and limiting alcohol can all lower blood pressure. If you need medicine, these changes still help it work better.",
      },
      {
        type: "paragraph",
        text: "A very high reading with chest pain, severe headache, shortness of breath or changes in vision needs emergency care. Don’t wait for a routine appointment.",
      },
    ],
  },
  {
    slug: "your-first-antenatal-appointment",
    title: "Your first antenatal appointment: what to expect",
    excerpt:
      "From the questions we’ll ask to the tests we’ll offer, here’s how to prepare for your first pregnancy appointment.",
    category: "Pregnancy",
    author: "amara-okafor",
    published: "2026-09-30",
    readMinutes: 4,
    body: [
      {
        type: "paragraph",
        text: "Your first antenatal appointment, often called the booking appointment, usually happens between 8 and 12 weeks of pregnancy. It’s longer than most visits, because it’s when we get to know you and plan your care together.",
      },
      { type: "heading", text: "What we’ll talk about" },
      {
        type: "list",
        items: [
          "Your health, any previous pregnancies and your family history",
          "Medicines and supplements you take, including folic acid",
          "Your work, home life and any support you might need",
          "The screening tests on offer, so you can decide which you’d like",
        ],
      },
      { type: "heading", text: "Checks and tests" },
      {
        type: "paragraph",
        text: "We’ll check your blood pressure, weight and urine, and offer blood tests for your blood group, iron levels and certain infections. We’ll also arrange your first scan.",
      },
      { type: "heading", text: "What to bring" },
      {
        type: "paragraph",
        text: "Bring a list of your medicines, the date of your last period if you know it, and any questions, however small. You’re welcome to bring your partner or a friend.",
      },
      {
        type: "paragraph",
        text: "If you have heavy bleeding, severe abdominal pain, or feel faint at any stage of pregnancy, seek emergency care straight away.",
      },
    ],
  },
  {
    slug: "headaches-when-to-see-a-doctor",
    title: "Headaches: when to rest, when to book and when to call for help",
    excerpt:
      "Most headaches aren’t serious. A few warning signs mean you should see a doctor, and some need emergency care.",
    category: "Neurology",
    author: "samuel-adeyemi",
    published: "2026-09-12",
    readMinutes: 4,
    body: [
      {
        type: "paragraph",
        text: "Almost everyone gets headaches, and most are caused by tension, dehydration, poor sleep or migraine. They usually ease with rest, fluids and simple painkillers.",
      },
      { type: "heading", text: "Book an appointment if" },
      {
        type: "list",
        items: [
          "You get headaches several times a week, or they’re getting more frequent",
          "You’re taking painkillers on more than 10 days a month",
          "Headaches wake you from sleep or are worst when you wake up",
          "Your usual headaches have changed in pattern or feel different",
        ],
      },
      { type: "heading", text: "Get emergency help if a headache" },
      {
        type: "list",
        items: [
          "Comes on suddenly and is the worst you’ve ever had",
          "Follows a head injury",
          "Comes with a stiff neck, fever and a rash",
          "Comes with weakness, numbness, confusion, slurred speech or loss of vision",
        ],
      },
      {
        type: "paragraph",
        text: "Keeping a headache diary of when headaches start, how long they last and what you were doing helps your doctor find the cause faster.",
      },
    ],
  },
];

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

/** Articles newest first. */
export const articlesByDate = [...articles].sort((a, b) => b.published.localeCompare(a.published));
