import { ScrollReveal } from "@/components/landing/scroll-reveal";

export function LandingPhilosophy() {
  return (
    <section className="bg-sea px-6 py-20 text-white">
      <ScrollReveal className="mx-auto max-w-xl text-center">
        <p className="font-heading text-[22px] font-medium leading-snug sm:text-[26px]">
          coralQ не карає за пропущений день і не веде рахунок провалам.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-white/85 sm:text-[17px]">
          Ти обираєш, скільки маєш сил зараз, — застосунок підбирає задачу під це, а не навпаки.
        </p>
      </ScrollReveal>
    </section>
  );
}
