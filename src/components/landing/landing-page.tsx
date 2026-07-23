import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";
import { LandingFocusDemo } from "@/components/landing/landing-focus-demo";
import { LandingAquariumDemo } from "@/components/landing/landing-aquarium-demo";
import { LandingTelegramDemo } from "@/components/landing/landing-telegram-demo";
import { LandingSteps } from "@/components/landing/landing-steps";
import { LandingTech } from "@/components/landing/landing-tech";
import { LandingFooterCta } from "@/components/landing/landing-footer-cta";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFocusDemo />
      <LandingAquariumDemo />
      <LandingTelegramDemo />
      <LandingSteps />
      <LandingTech />
      <LandingFooterCta />
    </main>
  );
}
