import { ScrollReveal } from "@/components/landing/scroll-reveal";

const STEPS = [
  {
    n: 1,
    en: "Capture",
    title: "Захоплення думок",
    body: "Скажи чи напиши все, що в голові, — голосом або текстом. Без структури, без фільтра.",
  },
  {
    n: 2,
    en: "Inbox",
    title: "Вхідні",
    body: "ШІ лагідно розкладає це на задачі: пріоритет, час, енергія. Нічого не тисне.",
  },
  {
    n: 3,
    en: "Today",
    title: "Сьогодні",
    body: "План на сьогодні, зібраний із беклогу, — стільки, скільки реально можеш зробити.",
  },
];

export function LandingFlow() {
  return (
    <section className="bg-card px-6 py-20">
      <ScrollReveal className="mx-auto max-w-4xl">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Як це працює</h2>
        <p className="mt-2 text-center text-[14.5px] text-ink-soft">
          coralQ — це таск-менеджер. Простий цикл: вивали усе з голови, дай ШІ розкласти на задачі, виконуй план на
          сьогодні.
        </p>
        <div className="mt-8 flex flex-wrap items-stretch justify-center gap-2.5">
          {STEPS.map((step, i) => (
            <div key={step.n} className="flex items-stretch gap-2.5">
              <div className="w-[210px] max-w-[250px] rounded-[20px] border border-line bg-paper p-[22px_18px]">
                <span className="flex size-7 items-center justify-center rounded-full bg-sea-soft font-heading text-[13px] font-semibold text-sea-deep">
                  {step.n}
                </span>
                <div className="mt-2.5 font-heading text-[21px] font-semibold tracking-tight text-sea-deep">
                  {step.en}
                </div>
                <h3 className="mt-0.5 text-[14px] font-extrabold text-ink">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{step.body}</p>
              </div>
              {i < STEPS.length - 1 && (
                <span className="flex items-center text-[22px] text-ink-soft" aria-hidden>
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
