import { AquariumTank } from "@/components/gentle/aquarium-tank";
import { SPECIES } from "@/lib/aquarium-species";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

export function LandingAquariumDemo() {
  return (
    <section className="bg-sea-soft px-6 py-20">
      <ScrollReveal className="mx-auto max-w-md">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Акваріум — святкує твої перемоги</h2>
        <p className="mt-2 text-center text-[14.5px] text-ink-soft">
          Заверши задачу — і зустрічай нову рибку в акваріумі. Це святкування прогресу, а не ще один стрік, який можна зламати.
        </p>
        <div className="mt-6">
          <AquariumTank eggs={1} unlocked={SPECIES.slice(0, 5)} swimmerCount={5} />
        </div>
      </ScrollReveal>
    </section>
  );
}
