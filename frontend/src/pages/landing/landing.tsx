import { CtaSection } from "@/components/landing/cta-section";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { Privacy } from "@/components/landing/privacy";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Statement } from "@/components/landing/statement";

export function LandingPage() {
  // The marketing site uses the dark theme; the app itself stays light.
  return (
    <div className="dark relative z-10 min-h-screen overflow-x-clip bg-background text-foreground [color-scheme:dark]">
      <SiteHeader />
      <main>
        <Hero />
        <Statement />
        <Features />
        <Privacy />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  );
}
