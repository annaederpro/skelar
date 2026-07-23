"use client";

import { useEffect, useState } from "react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

const STAGES = ["capture", "processing", "done"] as const;
type Stage = (typeof STAGES)[number];
const STAGE_DURATION_MS = 2200;

export function LandingCaptureDemo() {
  const reducedMotion = usePrefersReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);
  const stage: Stage = STAGES[stageIndex];

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setStageIndex((i) => (i + 1) % STAGES.length), STAGE_DURATION_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const parsed = stage === "processing" || stage === "done";

  return (
    <section className="bg-paper px-6 py-20">
      <ScrollReveal className="mx-auto max-w-3xl">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Capture — двома способами</h2>
        <p className="mt-2 text-center text-[14.5px] text-ink-soft">
          Додай задачу прямо в застосунку — або скинь голосове чи текстове повідомлення в Telegram. Обирай, що
          зручніше зараз.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2.5 text-center text-[11.5px] font-extrabold uppercase tracking-wide text-ink-soft">
              У застосунку
            </div>
            <div className="overflow-hidden rounded-[20px] border border-line bg-card shadow-[0_4px_16px_rgba(46,63,61,.08)]">
              <div className="flex items-center justify-between border-b border-line px-4 py-[13px]">
                <span className="font-heading text-[15px] font-semibold text-ink">Нова задача</span>
                <span className="text-[14px] text-ink-soft">✕</span>
              </div>
              <div className="min-h-[150px] p-4">
                {!parsed ? (
                  <div>
                    <div className="min-h-[58px] rounded-xl border-[1.5px] border-sea-soft bg-paper p-[10px_12px] text-[12px] text-ink-soft">
                      Напиши або наговори задачу…
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-full bg-sea py-[9px] text-[12.5px] font-extrabold text-white"
                      >
                        ✨ Створити
                      </button>
                      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full border border-line bg-paper text-[13px]">
                        🎤
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-sand-soft px-[9px] py-1 text-[11px] font-bold text-[#8a7238]">
                      ✨ Ось що я зрозумів — підправ, якщо треба
                    </span>
                    <div className="mt-2.5 rounded-[10px] border border-line p-[9px_11px] text-[12.5px] font-bold text-ink">
                      Відправити тестове завдання
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-flex gap-1">
                          <span className="size-[9px] rounded-full bg-line" />
                          <span className="size-[9px] rounded-full bg-sea" />
                          <span className="size-[9px] rounded-full bg-line" />
                        </span>
                        <span className="ml-0.5 text-[11px] text-ink-soft">середня</span>
                      </span>
                      <span className="rounded-lg border border-line px-2 py-1 text-[11.5px] font-bold text-ink">
                        30 хв
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <span className="rounded-full bg-coral-soft px-[10px] py-1 text-[11px] font-bold text-coral">
                        Важливо
                      </span>
                      <span className="rounded-full border border-line px-[10px] py-1 text-[11px] font-bold text-ink-soft">
                        Звичайне
                      </span>
                      <span className="rounded-full border border-line px-[10px] py-1 text-[11px] font-bold text-ink-soft">
                        Колись
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-3 w-full rounded-full bg-sea py-[9px] text-[12.5px] font-extrabold text-white"
                    >
                      + Додати
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2.5 text-center text-[11.5px] font-extrabold uppercase tracking-wide text-ink-soft">
              У Telegram
            </div>
            <div className="flex min-h-[150px] flex-col justify-end gap-2.5 rounded-[20px] border border-line bg-card p-4 shadow-[0_4px_16px_rgba(46,63,61,.08)]">
              <div className="ml-auto flex max-w-[85%] items-center gap-2 rounded-2xl rounded-br-sm bg-sea px-3.5 py-2.5 text-white">
                <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-white/25 text-[10px]">
                  ▶
                </span>
                <span className="flex items-end gap-[2.5px]" aria-hidden>
                  {[6, 12, 8, 16, 5, 11, 7].map((h, i) => (
                    <span key={i} className="w-[2.5px] rounded-sm bg-white/85" style={{ height: h }} />
                  ))}
                </span>
                <span className="text-[12.5px] font-bold">0:16</span>
              </div>
              {(stage === "processing" || stage === "done") && (
                <div className="mr-auto flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-line px-3.5 py-2.5 text-ink-soft">
                  <span>✨</span>
                  <span className="text-[12.5px] font-bold">
                    {stage === "processing" ? "Розпізнаю…" : "Готово"}
                  </span>
                </div>
              )}
              {stage === "done" && (
                <div className="mr-auto rounded-2xl rounded-bl-sm border border-line bg-card px-3.5 py-2.5 text-[13px] font-semibold text-ink shadow-[0_2px_10px_rgba(46,63,61,.06)]">
                  ✅ Додано: «Сходити за покупками» · 30 хв · легка
                </div>
              )}
            </div>
          </div>
        </div>

        {reducedMotion && (
          <button
            type="button"
            onClick={() => setStageIndex((i) => (i + 1) % STAGES.length)}
            className={cn(
              "mx-auto mt-4 block rounded-full bg-muted px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:bg-muted/70",
            )}
          >
            ▶ Показати наступний крок
          </button>
        )}
      </ScrollReveal>
    </section>
  );
}
