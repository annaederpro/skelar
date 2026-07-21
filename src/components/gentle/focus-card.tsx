"use client";

import { useMemo, useState } from "react";
import { Waves } from "lucide-react";
import { useResourceStatus } from "@/context/resource-status-context";
import { FocusSessionModal } from "@/components/gentle/focus-session-modal";
import { CelebrationModal, type CelebrationKind } from "@/components/gentle/celebration-modal";
import { EFFORT_WORD, priorityBucket, PRIORITY_BUCKET_LABEL } from "@/types/gentle";
import type { DbTask, ResourceStatus } from "@/types/gentle";
import { cn } from "@/lib/utils";

interface FocusCardProps {
  tasks: DbTask[];
}

const TIME_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 хв" },
  { minutes: 30, label: "30 хв" },
  { minutes: 45, label: "45 хв" },
  { minutes: 999, label: "Понад годину" },
];

const ENERGY_BY_STATUS: Record<ResourceStatus, 1 | 2 | 3> = {
  depleted: 1,
  normal: 2,
  high: 3,
};

const ENERGY_WORD: Record<1 | 2 | 3, string> = {
  1: "мало сил",
  2: "нормальний рівень",
  3: "повний заряд",
};

const PRIORITY_WEIGHT: Record<ReturnType<typeof priorityBucket>, number> = {
  high: 3,
  mid: 2,
  low: 1,
};

export function FocusCard({ tasks }: FocusCardProps) {
  const { resourceStatus } = useResourceStatus();
  const energy = ENERGY_BY_STATUS[resourceStatus];

  const [selectedMin, setSelectedMin] = useState<number | null>(null);
  const [poolIndex, setPoolIndex] = useState(0);
  const [sessionTask, setSessionTask] = useState<DbTask | null>(null);
  const [celebration, setCelebration] = useState<{ kind: CelebrationKind; title: string } | null>(null);

  const pool = useMemo(() => {
    if (selectedMin === null) return [];
    return tasks
      .filter((t) => t.energy_level <= energy && t.duration_minutes <= selectedMin)
      .sort((a, b) => {
        const w = PRIORITY_WEIGHT[priorityBucket(b.priority)] - PRIORITY_WEIGHT[priorityBucket(a.priority)];
        return w !== 0 ? w : a.duration_minutes - b.duration_minutes;
      });
  }, [tasks, selectedMin, energy]);

  const suggested = pool.length > 0 ? pool[poolIndex % pool.length] : null;

  const handlePickTime = (minutes: number) => {
    setSelectedMin(minutes);
    setPoolIndex(0);
  };

  const handleCelebrationClose = () => {
    setCelebration(null);
    setSelectedMin(null);
    setPoolIndex(0);
  };

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-sea to-sea-deep p-[18px] text-white shadow-[0_10px_26px_rgba(46,110,122,.32)]">
      <div className="mb-0.5 flex items-center gap-2">
        <Waves className="size-5" aria-hidden />
        <span className="font-heading text-[18px] font-semibold">Фокус зараз</span>
      </div>
      <p className="mb-3.5 text-[13px] leading-relaxed text-white/85">
        Скільки в тебе вільного часу? Підберу одну задачу під твій час і сили.
      </p>

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
              <p className="mb-1.5 text-xs text-white/85">
                ✦ Підходить під «{ENERGY_WORD[energy]}» і {selectedMin === 999 ? "вільний час" : `${selectedMin} хв`},
                що в тебе є
              </p>
              <p className="text-[16px] font-bold leading-snug">{suggested.title}</p>
              <p className="mt-1.5 flex items-center gap-3 text-[12.5px] text-white/85">
                <span>🕐 {suggested.duration_minutes} хв</span>
                <span>{EFFORT_WORD[suggested.energy_level]}</span>
                <span>{PRIORITY_BUCKET_LABEL[priorityBucket(suggested.priority)]}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSessionTask(suggested)}
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
            <>
              <p className="mb-1.5 text-xs text-white/85">🍵 На цей проміжок і рівень сил нічого важкого нема</p>
              <p className="text-[16px] font-bold leading-snug">Може, це знак трохи відпочити?</p>
              <p className="mt-1.5 text-[12.5px] text-white/85">
                Склянка води, кілька вдихів — теж корисна справа.
              </p>
            </>
          )}
        </div>
      )}

      <FocusSessionModal
        task={sessionTask}
        onClose={() => setSessionTask(null)}
        onCelebrate={(kind, title) => setCelebration({ kind, title })}
        onLeaveEgg={(title) => setCelebration({ kind: "egg", title })}
      />
      <CelebrationModal
        kind={celebration?.kind ?? null}
        taskTitle={celebration?.title ?? ""}
        onClose={handleCelebrationClose}
      />
    </div>
  );
}
