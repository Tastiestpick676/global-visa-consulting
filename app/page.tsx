// app/page.tsx
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProcessSteps } from "@/components/landing/ProcessSteps";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { Footer } from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-white">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <ProcessSteps />
        <PricingSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
}