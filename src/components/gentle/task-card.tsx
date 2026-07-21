"use client";

import { Clock, Check } from "lucide-react";
import type { DbTask, EnergyLevel } from "@/types/gentle";
import {
  EFFORT_WORD,
  priorityBucket,
  PRIORITY_BUCKET_LABEL,
  PRIORITY_BUCKET_PILL_CLASS,
  PRIORITY_BUCKET_BAR_CLASS,
} from "@/types/gentle";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: DbTask;
  onToggleComplete?: (task: DbTask) => void;
}

function EffortDots({ level }: { level: EnergyLevel }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-[3px]">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "size-[7px] rounded-full",
              i <= level ? "bg-sea" : "bg-line",
            )}
          />
        ))}
      </span>
      {EFFORT_WORD[level]}
    </span>
  );
}

export function TaskCard({ task, onToggleComplete }: TaskCardProps) {
  const isCompleted = task.status === "completed";
  const bucket = priorityBucket(task.priority);
  const isSeeded = task.is_seeded && !isCompleted;

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-[20px] border border-line bg-card p-[14px_15px] shadow-sm transition-all",
        isCompleted && "bg-paper/60",
      )}
    >
      {/* left accent bar: coral for high priority, sea for a seeded task */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          isSeeded ? "bg-sea" : PRIORITY_BUCKET_BAR_CLASS[bucket],
        )}
        aria-hidden
      />

      <button
        type="button"
        onClick={() => onToggleComplete?.(task)}
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isCompleted
            ? "border-sea bg-sea text-white"
            : "border-ink-soft/30 text-transparent hover:border-sea",
        )}
        aria-label={isCompleted ? "Позначити як невиконану" : "Позначити як виконану"}
      >
        <Check className="size-[14px]" strokeWidth={3.5} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "text-[15px] font-semibold leading-tight",
              isCompleted && "text-ink-soft line-through decoration-line",
            )}
          >
            {task.title}
          </span>
          <span
            className={cn(
              "rounded-full px-[9px] py-[3px] text-[10.5px] font-extrabold",
              PRIORITY_BUCKET_PILL_CLASS[bucket],
              isCompleted && "opacity-50",
            )}
          >
            {PRIORITY_BUCKET_LABEL[bucket]}
          </span>
        </div>
        <div
          className={cn(
            "mt-1.5 flex flex-wrap items-center gap-3 text-[12.5px] text-ink-soft",
            isCompleted && "opacity-50",
          )}
        >
          <span className="flex items-center gap-[5px]">
            <Clock className="size-3.5" />
            {task.duration_minutes} хв
          </span>
          <EffortDots level={task.energy_level} />
          {isSeeded && (
            <span className="font-bold text-sea-deep">🥚 ікринка</span>
          )}
        </div>
      </div>
    </div>
  );
}
