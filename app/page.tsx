import { ArticlesSection } from "@/components/home/articles-section";
import { DepartmentsSection } from "@/components/home/departments-section";
import { DoctorsSection } from "@/components/home/doctors-section";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { TrustSection } from "@/components/home/trust-section";
import { VisitSection } from "@/components/home/visit-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <DepartmentsSection />
      <DoctorsSection />
      <HowItWorks />
      <TrustSection />
      <VisitSection />
      <ArticlesSection />
    </>
  );
}
