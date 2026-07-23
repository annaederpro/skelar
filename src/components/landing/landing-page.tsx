import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";
import { LandingFlow } from "@/components/landing/landing-flow";
import { LandingCaptureDemo } from "@/components/landing/landing-capture-demo";
import { LandingFocusDemo } from "@/components/landing/landing-focus-demo";
import { LandingAquariumDemo } from "@/components/landing/landing-aquarium-demo";
import { LandingTech } from "@/components/landing/landing-tech";
import { LandingFooterCta } from "@/components/landing/landing-footer-cta";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFlow />
      <LandingCaptureDemo />
      <p className="mx-auto max-w-md px-6 py-10 text-center text-[15px] font-bold text-ink-soft">
        Це лише основа. А ще coralQ додає дрібку магії, щоб робота була в задоволення:
      </p>
      <LandingFocusDemo />
      <LandingAquariumDemo />
      <LandingTech />
      <LandingFooterCta />
    </main>
  );
}
