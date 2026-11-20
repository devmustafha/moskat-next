import type { ImageAsset } from "@/lib/images";
import type { Department, Doctor } from "@/lib/db/types";

/**
 * Sample catalogue loaded by `npm run db:seed`. Names, qualifications and biographies are fictional
 * placeholders; photos are from Unsplash. Replace with the hospital's real, verified data.
 */
export type SeedDepartment = Omit<Department, "id">;

export type SeedDoctor = Omit<Doctor, "id" | "currency" | "timeZone" | "photo"> & { photo?: ImageAsset };

export const seedDepartments: SeedDepartment[] = [
  {
    slug: "cardiology",
    name: "Cardiology",
    icon: "heart-pulse",
    summary: "Heart checks, diagnosis and long-term care for heart and blood pressure conditions.",
    intro:
      "Our cardiology team looks after hearts at every stage, from a first blood pressure check to living well with a long-term condition. Most tests happen on the day of your visit, so you leave with answers rather than another appointment.",
    services: [
      { name: "ECG", description: "A quick, painless recording of your heart’s rhythm, read by a cardiologist." },
      { name: "Echocardiography", description: "An ultrasound scan that shows how your heart muscle and valves are working." },
      { name: "Hypertension clinic", description: "Diagnosis, home monitoring plans and medication reviews for high blood pressure." },
      { name: "Heart rhythm monitoring", description: "24-hour and 7-day monitors to catch palpitations that come and go." },
    ],
    conditions: ["High blood pressure", "Chest pain (non-urgent)", "Palpitations", "High cholesterol", "Heart failure"],
    location: "Building A, level 2",
    onlineConsultations: true,
  },
  {
    slug: "paediatrics",
    name: "Paediatrics",
    icon: "baby",
    summary: "Gentle, family-centred care for babies, children and teenagers.",
    intro:
      "Children aren’t small adults, and our paediatric team never treats them that way. Appointments are unhurried, parents stay in the room, and our play specialists help make tests and procedures less frightening.",
    services: [
      { name: "Child wellness checks", description: "Growth, development and wellbeing reviews from birth to 18." },
      { name: "Vaccinations", description: "Routine childhood immunisations and catch-up schedules." },
      { name: "Newborn care", description: "Checks, feeding support and advice in the first weeks at home." },
      { name: "Allergy & asthma clinic", description: "Diagnosis and care plans for allergies, eczema and asthma." },
    ],
    conditions: ["Fevers and infections", "Asthma", "Allergies and eczema", "Feeding concerns", "Growth and development"],
    location: "Building B, ground floor",
    onlineConsultations: true,
  },
  {
    slug: "womens-health",
    name: "Women’s health",
    icon: "venus",
    summary: "Obstetrics and gynaecology, from routine screening to pregnancy and birth.",
    intro:
      "Our obstetrics and gynaecology team supports women through every stage of life. You’ll see the same small team throughout your pregnancy, and every scan and test is explained in plain language.",
    services: [
      { name: "Antenatal care", description: "Scans, checks and classes from your first appointment to your due date." },
      { name: "Cervical screening", description: "Routine screening and follow-up, with results shared securely." },
      { name: "Gynaecology clinic", description: "Assessment and treatment for period problems, pelvic pain and menopause." },
      { name: "Fertility advice", description: "Initial assessment, tests and guidance on next steps." },
    ],
    conditions: ["Pregnancy", "Heavy or painful periods", "Endometriosis", "Menopause", "Polycystic ovary syndrome"],
    location: "Building B, level 1",
    onlineConsultations: true,
  },
  {
    slug: "orthopaedics",
    name: "Orthopaedics",
    icon: "bone",
    summary: "Treatment and rehabilitation for bones, joints, muscles and sports injuries.",
    intro:
      "Whether it’s a sports injury or years of joint pain, our orthopaedic surgeons and physiotherapists work as one team. Surgery is only ever one option, and we’ll talk through every alternative first.",
    services: [
      { name: "Joint clinic", description: "Assessment and treatment for hip, knee and shoulder pain." },
      { name: "Fracture clinic", description: "Follow-up care for broken bones after emergency treatment." },
      { name: "Sports injury clinic", description: "Diagnosis and return-to-sport plans for active people of all levels." },
      { name: "Physiotherapy", description: "One-to-one rehabilitation before and after injury or surgery." },
    ],
    conditions: ["Knee and hip pain", "Sports injuries", "Back and neck pain", "Arthritis", "Fracture follow-up"],
    location: "Building A, ground floor",
    onlineConsultations: true,
  },
  {
    slug: "neurology",
    name: "Neurology",
    icon: "brain",
    summary: "Specialist assessment and care for headaches, epilepsy, stroke and nerve conditions.",
    intro:
      "Neurological symptoms can be worrying and hard to describe. Our neurologists take a careful history, arrange the right tests, and give you a clear plan, with a named nurse you can contact between appointments.",
    services: [
      { name: "Headache clinic", description: "Diagnosis and treatment plans for migraine and other headaches." },
      { name: "EEG", description: "A recording of the brain’s electrical activity, used to investigate seizures." },
      { name: "Epilepsy clinic", description: "Ongoing care, medication reviews and support for living with epilepsy." },
      { name: "Stroke follow-up", description: "Recovery reviews and prevention plans after a stroke or mini-stroke." },
    ],
    conditions: ["Migraine", "Epilepsy", "Numbness or tingling", "Memory concerns", "Recovery after stroke"],
    location: "Building C, level 2",
    onlineConsultations: true,
  },
  {
    slug: "diagnostics",
    name: "Diagnostics & imaging",
    icon: "microscope",
    summary: "Fast, accurate laboratory tests and imaging, with results shared with your doctor.",
    intro:
      "Our on-site laboratory and imaging suite mean most tests are done in one visit. Results go straight to your doctor, and you can see them in your patient account as soon as they’ve been reviewed.",
    services: [
      { name: "Blood tests", description: "Walk-in phlebotomy, with most routine results the same day." },
      { name: "Ultrasound", description: "Abdominal, pelvic, pregnancy and vascular scans." },
      { name: "X-ray", description: "Walk-in digital X-ray with a radiologist’s report." },
      { name: "MRI & CT", description: "Detailed scans by appointment, with calm, spacious scanning rooms." },
    ],
    conditions: ["Routine screening", "Pre-operative tests", "Investigating symptoms", "Monitoring long-term conditions"],
    location: "Building C, ground floor",
    onlineConsultations: false,
  },
];

export const seedDoctors: SeedDoctor[] = [
  {
    slug: "amara-okafor",
    name: "Dr. Amara Okafor",
    specialty: "Obstetrician & gynaecologist",
    department: "womens-health",
    yearsExperience: 14,
    qualifications: ["MBBS, University of Lagos", "MRCOG, Royal College of Obstetricians & Gynaecologists", "Diploma in Fetal Medicine"],
    languages: ["English", "Igbo"],
    bio: [
      "Dr. Okafor leads our antenatal service and has supported thousands of families through pregnancy and birth. She is known for explaining every option clearly, so patients feel part of each decision.",
      "Before joining Moskat she trained in fetal medicine and worked in a busy teaching hospital labour ward.",
    ],
    interests: ["High-risk pregnancy", "Antenatal care", "Endometriosis", "Menopause"],
    videoDays: ["Monday", "Wednesday", "Friday"],
    consultationFeeCents: 2_500_000,
    consultationMinutes: 30,
    photo: {
      src: "https://images.unsplash.com/photo-1643297654416-05795d62e39c",
      width: 800,
      height: 1000,
      alt: "Portrait of Dr. Amara Okafor smiling, wearing a white coat and holding a stethoscope",
      credit: "Eben Kassaye on Unsplash",
    },
  },
  {
    slug: "arjun-mehta",
    name: "Dr. Arjun Mehta",
    specialty: "Consultant cardiologist",
    department: "cardiology",
    yearsExperience: 12,
    qualifications: ["MBBS, MD (Internal Medicine)", "DM (Cardiology)", "Fellow, American College of Cardiology"],
    languages: ["English", "Hindi"],
    bio: [
      "Dr. Mehta specialises in preventing heart disease and in helping people manage high blood pressure for the long term. He runs our hypertension clinic and the cardiac rehabilitation programme.",
      "He believes most heart health happens between appointments, so he spends time making sure every patient leaves with a plan they can follow at home.",
    ],
    interests: ["Hypertension", "Preventive cardiology", "Heart failure", "Cardiac rehabilitation"],
    videoDays: ["Tuesday", "Thursday"],
    consultationFeeCents: 3_500_000,
    consultationMinutes: 30,
    photo: {
      src: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d",
      width: 800,
      height: 1000,
      alt: "Portrait of Dr. Arjun Mehta in a white coat with a stethoscope, arms crossed",
      credit: "Usman Yousaf on Unsplash",
    },
  },
  {
    slug: "elena-ruiz",
    name: "Dr. Elena Ruiz",
    specialty: "Paediatrician",
    department: "paediatrics",
    yearsExperience: 9,
    qualifications: ["MD, Universidad de Barcelona", "Board certified in Paediatrics", "Postgraduate Certificate in Paediatric Allergy"],
    languages: ["English", "Spanish"],
    bio: [
      "Dr. Ruiz cares for children from newborns to teenagers, with a particular interest in allergies, eczema and asthma. Parents value her calm manner and practical advice.",
      "She runs our evening video clinic, so families can get advice without taking children out of school.",
    ],
    interests: ["Childhood asthma", "Food allergy", "Eczema", "Newborn care"],
    videoDays: ["Monday", "Tuesday", "Thursday", "Saturday"],
    consultationFeeCents: 2_000_000,
    consultationMinutes: 20,
    photo: {
      src: "https://images.unsplash.com/photo-1594824476967-48c8b964273f",
      width: 800,
      height: 1000,
      alt: "Portrait of Dr. Elena Ruiz smiling, wearing teal medical scrubs",
      credit: "Ocho Artex Media on Unsplash",
    },
  },
  {
    slug: "daniel-costa",
    name: "Dr. Daniel Costa",
    specialty: "Orthopaedic & sports medicine",
    department: "orthopaedics",
    yearsExperience: 11,
    qualifications: ["MD, University of Porto", "Fellowship in Sports & Exercise Medicine", "Member, Orthopaedic Trauma Association"],
    languages: ["English", "Portuguese"],
    bio: [
      "Dr. Costa treats sports injuries and joint pain in people of every age and fitness level. He works closely with our physiotherapists so treatment and rehabilitation follow one plan.",
      "A former club runner himself, he focuses on getting patients safely back to the activities they love.",
    ],
    interests: ["Knee injuries", "Running injuries", "Shoulder pain", "Return to sport"],
    videoDays: ["Wednesday", "Friday"],
    consultationFeeCents: 3_000_000,
    consultationMinutes: 20,
    photo: {
      src: "https://images.unsplash.com/photo-1622253692010-333f2da6031d",
      width: 800,
      height: 1000,
      alt: "Portrait of Dr. Daniel Costa smiling, wearing blue scrubs with a stethoscope",
      credit: "Bruno Rodrigues on Unsplash",
    },
  },
  {
    slug: "samuel-adeyemi",
    name: "Dr. Samuel Adeyemi",
    specialty: "Consultant neurologist",
    department: "neurology",
    yearsExperience: 16,
    qualifications: ["MBChB, University of Ibadan", "FRCP, Royal College of Physicians", "Fellowship in Headache Medicine"],
    languages: ["English", "Yoruba", "French"],
    bio: [
      "Dr. Adeyemi leads our headache and epilepsy clinics. He takes a detailed history at every first appointment, because the right diagnosis usually starts with listening.",
      "He also runs our stroke follow-up service, helping patients and families plan recovery and lower the risk of another stroke.",
    ],
    interests: ["Migraine", "Epilepsy", "Stroke prevention", "Nerve pain"],
    videoDays: ["Monday", "Thursday"],
    consultationFeeCents: 4_000_000,
    consultationMinutes: 30,
  },
  {
    slug: "hana-sato",
    name: "Dr. Hana Sato",
    specialty: "Cardiologist, heart rhythm",
    department: "cardiology",
    yearsExperience: 8,
    qualifications: ["MD, Keio University", "Board certified in Cardiovascular Disease", "Certified Cardiac Device Specialist"],
    languages: ["English", "Japanese"],
    bio: [
      "Dr. Sato specialises in heart rhythm problems, from occasional palpitations to atrial fibrillation. She reviews rhythm monitor results by video, so many patients don’t need to come in.",
      "She is passionate about helping patients understand their own heart readings and wearable data.",
    ],
    interests: ["Palpitations", "Atrial fibrillation", "Pacemaker follow-up", "Wearable heart data"],
    videoDays: ["Tuesday", "Wednesday", "Saturday"],
    consultationFeeCents: 3_500_000,
    consultationMinutes: 20,
  },
];
