import FeaturesSection from "@/components/features-section";
import HeroSection from "@/components/hero-section";
import Navbar from "@/components/navbar";

export function LandingPage() {
  return (
    <div className="relative z-10 min-h-screen">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
    </div>
  );
}
