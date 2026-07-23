"use client";

import { useEffect, useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const STAGES = ["voice", "parsing", "task"] as const;
type Stage = (typeof STAGES)[number];
const STAGE_DURATION_MS = 2200;

export function LandingTelegramDemo() {
  const reducedMotion = usePrefersReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);
  const stage: Stage = STAGES[stageIndex];

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setStageIndex((i) => (i + 1) % STAGES.length), STAGE_DURATION_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <section className="bg-white px-6 py-20">
      <ScrollReveal className="mx-auto max-w-md">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Скинь думку в Telegram</h2>
        <p className="mt-2 text-center text-[14.5px] text-ink-soft">
          Голосове чи текстове повідомлення саме стає задачею — з часом, енергією і пріоритетом.
        </p>

        <div className="mt-6 rounded-[24px] border border-line bg-paper p-5">
          <div className="flex min-h-[132px] flex-col justify-end gap-2.5">
            {(stage === "voice" || stage === "parsing" || stage === "task") && (
              <div className="ml-auto flex max-w-[78%] items-center gap-2 rounded-[16px] rounded-br-sm bg-sea px-3.5 py-2.5 text-white">
                <Mic className="size-4 shrink-0" aria-hidden />
                <span className="flex items-end gap-[3px]" aria-hidden>
                  {[6, 12, 8, 16, 5].map((h, i) => (
                    <span key={i} className="w-[3px] rounded-full bg-white/80" style={{ height: h }} />
                  ))}
                </span>
                <span className="text-[12.5px] font-bold">0:07</span>
              </div>
            )}
            {(stage === "parsing" || stage === "task") && (
              <div className="mr-auto flex items-center gap-1.5 rounded-[16px] rounded-bl-sm bg-muted px-3.5 py-2.5 text-ink-soft">
                <Sparkles className="size-4" aria-hidden />
                <span className="text-[12.5px] font-bold">{stage === "parsing" ? "Розпізнаю…" : "Готово"}</span>
              </div>
            )}
            {stage === "task" && (
              <div className="mr-auto w-full max-w-[86%] rounded-[16px] rounded-bl-sm border border-line bg-card p-3.5 shadow-sm">
                <p className="text-[14px] font-semibold text-ink">Підготувати презентацію для клієнта</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-soft">
                  <span className="rounded-full bg-sea-soft px-2 py-0.5 font-bold text-sea-deep">🕐 45 хв</span>
                  <span className="rounded-full bg-anem-soft px-2 py-0.5 font-bold text-anem">глибока</span>
                  <span className="rounded-full bg-coral-soft px-2 py-0.5 font-bold text-coral">Важливо</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {reducedMotion && (
          <button
            type="button"
            onClick={() => setStageIndex((i) => (i + 1) % STAGES.length)}
            className="mx-auto mt-3 block rounded-full bg-muted px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:bg-muted/70"
          >
            ▶ Показати наступний крок
          </button>
        )}
      </ScrollReveal>
    </section>
  );
}
