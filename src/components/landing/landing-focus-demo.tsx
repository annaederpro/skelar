"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Waves, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CelebrationModal } from "@/components/gentle/celebration-modal";
import { EFFORT_WORD, PRIORITY_BUCKET_LABEL, formatDuration, type EnergyLevel, type PriorityBucket } from "@/types/gentle";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { useOceanNoise } from "@/lib/ocean-noise";
import { cn } from "@/lib/utils";

interface SampleTask {
  title: string;
  durationMinutes: number;
  energyLevel: EnergyLevel;
  priorityBucket: PriorityBucket;
}

// Fixed, self-contained sample data — never touches a visitor's real account.
const SAMPLE_TASKS: SampleTask[] = [
  { title: "Відповісти на лист від клієнта", durationMinutes: 15, energyLevel: 1, priorityBucket: "mid" },
  { title: "Прибрати на столі", durationMinutes: 15, energyLevel: 1, priorityBucket: "low" },
  { title: "Розібрати пошту", durationMinutes: 20, energyLevel: 2, priorityBucket: "mid" },
  { title: "Скласти план на тиждень", durationMinutes: 30, energyLevel: 2, priorityBucket: "high" },
  { title: "Підготувати презентацію", durationMinutes: 45, energyLevel: 3, priorityBucket: "high" },
];

// Demo energy is fixed at "В нормі" — the real mood selector lives in the
// authenticated app shell, not the landing page.
const DEMO_ENERGY: EnergyLevel = 2;

const TIME_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 хв" },
  { minutes: 30, label: "30 хв" },
  { minutes: 45, label: "45 хв" },
  { minutes: 999, label: "Понад годину" },
];

const PRIORITY_WEIGHT: Record<PriorityBucket, number> = { high: 3, mid: 2, low: 1 };

const DEMO_SESSION_MS = 4800;
const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function LandingFocusDemo() {
  const oceanNoise = useOceanNoise();
  const [selectedMin, setSelectedMin] = useState<number | null>(null);
  const [poolIndex, setPoolIndex] = useState(0);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const pool = useMemo(() => {
    if (selectedMin === null) return [];
    return SAMPLE_TASKS.filter(
      (t) => t.energyLevel <= DEMO_ENERGY && t.durationMinutes <= selectedMin,
    ).sort(
      (a, b) =>
        PRIORITY_WEIGHT[b.priorityBucket] - PRIORITY_WEIGHT[a.priorityBucket] ||
        a.durationMinutes - b.durationMinutes,
    );
  }, [selectedMin]);

  const suggested = pool.length > 0 ? pool[poolIndex % pool.length] : null;

  const handlePickTime = (minutes: number) => {
    setSelectedMin(minutes);
    setPoolIndex(0);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startSession = () => {
    setSessionOpen(true);
    setProgress(0);
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const next = Math.min(elapsed / DEMO_SESSION_MS, 1);
      setProgress(next);
      if (next < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setSessionOpen(false);
        setCelebrating(true);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const closeSession = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setSessionOpen(false);
  };

  return (
    <section className="bg-paper px-6 py-20">
      <ScrollReveal className="mx-auto max-w-md">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Фокус — з шумом моря</h2>
        <p className="mt-2 text-center text-[14.5px] text-ink-soft">
          Скажи, скільки в тебе часу й сил — отримаєш одну задачу, а не весь список. Увімкни шум моря, щоб зосередитись без поспіху.
        </p>

        <div className="relative mt-6 overflow-hidden rounded-[24px] bg-gradient-to-br from-sea to-sea-deep p-[18px] text-white shadow-[0_10px_26px_rgba(46,110,122,.32)]">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Waves className="size-5" aria-hidden />
              <span className="font-heading text-[18px] font-semibold">Спробуй прямо тут</span>
            </div>
            <button
              type="button"
              onClick={oceanNoise.toggle}
              aria-pressed={oceanNoise.isPlaying}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors",
                oceanNoise.isPlaying ? "bg-white text-sea-deep" : "bg-white/15 text-white hover:bg-white/25",
              )}
            >
              {oceanNoise.isPlaying ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              Шум моря
            </button>
          </div>
          <p className="mb-3.5 text-[13px] leading-relaxed text-white/85">Скільки в тебе вільного часу?</p>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Скільки часу">
            {TIME_OPTIONS.map(({ minutes, label }) => (
              <button
                key={minutes}
                type="button"
                onClick={() => handlePickTime(minutes)}
                aria-pressed={selectedMin === minutes}
                className={cn(
                  "rounded-[14px] border-[1.5px] px-3.5 py-2 text-[13.5px] font-bold transition-colors",
                  selectedMin === minutes
                    ? "border-white bg-white text-sea-deep"
                    : "border-white/35 bg-white/10 text-white hover:bg-white/20",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {selectedMin !== null && (
            <div className="mt-3.5 rounded-[18px] bg-white/[.14] p-3.5">
              {suggested ? (
                <>
                  <p className="mb-1.5 text-xs text-white/85">✦ Підходить під твій час і сили</p>
                  <p className="text-[16px] font-bold leading-snug">{suggested.title}</p>
                  <p className="mt-1.5 flex items-center gap-3 text-[12.5px] text-white/85">
                    <span>🕐 {formatDuration(suggested.durationMinutes)}</span>
                    <span>{EFFORT_WORD[suggested.energyLevel]}</span>
                    <span>{PRIORITY_BUCKET_LABEL[suggested.priorityBucket]}</span>
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={startSession}
                      className="flex-1 rounded-[14px] bg-white py-2.5 text-sm font-extrabold text-sea-deep transition-transform hover:-translate-y-px"
                    >
                      Почати фокус
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoolIndex((i) => i + 1)}
                      className="rounded-[14px] bg-white/15 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/25"
                    >
                      Інша
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[14px] font-bold leading-snug">На цей час нічого важкого нема — теж результат.</p>
              )}
            </div>
          )}
        </div>
      </ScrollReveal>

      <Dialog open={sessionOpen} onOpenChange={(next) => !next && closeSession()}>
        <DialogContent className="text-center" showCloseButton={false}>
          {suggested && (
            <>
              <div className="text-xs font-extrabold uppercase tracking-widest text-sea">Фокус</div>
              <h3 className="mt-2 font-heading text-lg font-semibold leading-tight">{suggested.title}</h3>
              <div className="relative mx-auto my-4 size-[160px]">
                <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
                  <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#DDE8E4" strokeWidth="10" />
                  <circle
                    cx="80"
                    cy="80"
                    r={RADIUS}
                    fill="none"
                    stroke="#3E8E9C"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-heading text-2xl font-semibold">{Math.round(progress * 100)}%</span>
                </div>
              </div>
              <p className="mx-auto max-w-[240px] text-[13px] leading-relaxed text-ink-soft">
                Демо-сесія — у застосунку таймер триває стільки, скільки реально потрібно.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CelebrationModal
        kind={celebrating ? "fish" : null}
        taskTitle={suggested?.title ?? ""}
        onClose={() => {
          setCelebrating(false);
          setSelectedMin(null);
          setPoolIndex(0);
        }}
      />
    </section>
  );
}
