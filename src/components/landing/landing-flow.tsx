import Image from "next/image";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

const STEPS = [
  {
    n: 1,
    en: "Capture",
    title: "Захоплення думок",
    body: "Скажи чи напиши все, що в голові, — голосом або текстом. Без структури, без фільтра.",
    screenshot: null,
  },
  {
    n: 2,
    en: "Inbox",
    title: "Вхідні",
    body: "ШІ лагідно розкладає це на задачі: пріоритет, час, енергія. Нічого не тисне.",
    screenshot: "/screenshots/inbox.png",
  },
  {
    n: 3,
    en: "Today",
    title: "Сьогодні",
    body: "План на сьогодні, зібраний із беклогу, — стільки, скільки реально можеш зробити.",
    screenshot: "/screenshots/today.png",
  },
] as const;

export function LandingFlow() {
  return (
    <section className="bg-card px-6 py-20">
      <ScrollReveal className="mx-auto max-w-4xl">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Як це працює</h2>
        <p className="mt-2 text-center text-[14.5px] text-ink-soft">
          coralQ — це таск-менеджер. Простий цикл: вивали усе з голови, дай ШІ розкласти на задачі, виконуй план на
          сьогодні.
        </p>
        <div className="mt-8 flex flex-col items-center gap-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-center">
          {STEPS.map((step, i) => (
            <div key={step.n} className="contents">
              <div className="w-full max-w-[320px] rounded-[20px] border border-line bg-paper p-[22px_18px] sm:w-[210px]">
                <span className="flex size-7 items-center justify-center rounded-full bg-sea-soft font-heading text-[13px] font-semibold text-sea-deep">
                  {step.n}
                </span>
                <div className="mt-2.5 font-heading text-[21px] font-semibold tracking-tight text-sea-deep">
                  {step.en}
                </div>
                <h3 className="mt-0.5 text-[14px] font-extrabold text-ink">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{step.body}</p>
                {step.screenshot && (
                  <div className="relative mt-3.5 h-[170px] w-full overflow-hidden rounded-[14px] border border-line shadow-[0_2px_10px_rgba(46,63,61,.08)]">
                    <Image
                      src={step.screenshot}
                      alt={`Реальний скріншот екрана «${step.en}» у coralQ`}
                      fill
                      sizes="(min-width: 640px) 210px, 320px"
                      className="object-cover object-top"
                    />
                  </div>
                )}
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className="flex h-9 rotate-90 items-center justify-center text-[22px] text-ink-soft sm:h-[54px] sm:rotate-0"
                  aria-hidden
                >
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
