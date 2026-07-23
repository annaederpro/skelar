import Image from "next/image";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: 1,
    en: "Capture",
    title: "Фіксація думок",
    body: "Надиктуй або напиши все, що в голові — голосовим чи текстом. Без структури, підбору слів і зайвих фільтрів.",
    screenshot: null,
  },
  {
    n: 2,
    en: "Inbox",
    title: "Вхідні",
    body: "ШІ лагідно впорядковує хаос: розкладе думки на задачі, визначить пріоритет, оцінить час та необхідну енергію.",
    screenshot: "/screenshots/inbox.png",
  },
  {
    n: 3,
    en: "Today",
    title: "Сьогодні",
    body: "Реалістичний план на день, підібраний під твій поточний ресурс — рівно стільки, скільки ти в силах зробити.",
    screenshot: "/screenshots/today.png",
  },
] as const;

function StepCard({ step, className }: { step: (typeof STEPS)[number]; className?: string }) {
  return (
    <div className={cn("rounded-[22px] bg-[#EFE3C7] p-6 shadow-[0_14px_34px_rgba(21,41,45,.16)]", className)}>
      <span className="flex size-8 items-center justify-center rounded-full bg-sea-soft font-heading text-[14px] font-semibold text-sea-deep">
        {step.n}
      </span>
      <div className="mt-3 text-[12px] font-extrabold uppercase tracking-[0.1em] text-sea-deep">{step.en}</div>
      <h3 className="mt-1 font-heading text-[25px] font-semibold leading-tight text-ink">{step.title}</h3>
      <p className="mt-2.5 text-[14px] leading-relaxed text-ink-soft">{step.body}</p>
      {step.screenshot && (
        <div className="relative mt-4 h-[190px] w-full overflow-hidden rounded-[16px] shadow-[0_8px_22px_rgba(21,41,45,.2)]">
          <Image
            src={step.screenshot}
            alt={`Реальний скріншот екрана «${step.en}» у coralQ`}
            fill
            sizes="(min-width: 640px) 340px, 320px"
            className="object-cover object-top"
          />
        </div>
      )}
    </div>
  );
}

export function LandingFlow() {
  const [capture, inbox, today] = STEPS;
  return (
    <section className="bg-sea px-6 py-20">
      <ScrollReveal className="mx-auto max-w-4xl">
        <h2 className="text-center font-heading text-[26px] font-semibold text-white">Як це працює</h2>
        <p className="mt-2 text-center text-[14.5px] text-white/85">
          <span className="text-[16px] font-bold text-white">coralQ</span> — це таск-менеджер із простим циклом:
          звільни голову від думок, дозволь ШІ впорядкувати задачі та виконуй рівно стільки, скільки в силах
          сьогодні.
        </p>

        <div className="relative mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-x-10">
          <span
            className="pointer-events-none absolute left-1/2 top-[70px] hidden -translate-x-1/2 text-[24px] text-white/70 sm:block"
            aria-hidden
          >
            →
          </span>

          <StepCard step={capture} />
          <StepCard step={inbox} className="sm:mt-16" />

          <div className="hidden justify-start pl-6 sm:flex sm:order-3">
            <div className="w-[200px] overflow-hidden rounded-[24px] shadow-[0_16px_36px_rgba(0,0,0,.28)]">
              {today.screenshot && (
                <Image
                  src={today.screenshot}
                  alt="Реальний скріншот екрана «Today» у coralQ"
                  width={220}
                  height={478}
                  className="w-full"
                />
              )}
            </div>
          </div>

          <StepCard step={today} className="sm:order-4 sm:-mt-8" />
        </div>
      </ScrollReveal>
    </section>
  );
}
