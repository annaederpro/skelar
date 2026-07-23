"use client";

import { Clock, Check, Folder, CalendarDays, CalendarPlus, Waves, Undo2 } from "lucide-react";
import type { DbTask, EnergyLevel } from "@/types/gentle";
import {
  EFFORT_WORD,
  formatDuration,
  formatDueTime,
  priorityBucket,
  PRIORITY_BUCKET_LABEL,
  PRIORITY_BUCKET_PILL_CLASS,
  PRIORITY_BUCKET_BAR_CLASS,
} from "@/types/gentle";
import { getAppToday } from "@/lib/date";
import { cn } from "@/lib/utils";
import { buildTaskIcs, downloadIcs, taskIcsFilename } from "@/lib/ics";

interface TaskCardProps {
  task: DbTask;
  projectName?: string;
  variant?: "active" | "released";
  onToggleComplete?: (task: DbTask) => void;
  onEdit?: (task: DbTask) => void;
  onRestore?: (task: DbTask) => void;
}

// "2026-07-22" → "22.07"
function formatDueDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}.${month}`;
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

export function TaskCard({
  task,
  projectName,
  variant = "active",
  onToggleComplete,
  onEdit,
  onRestore,
}: TaskCardProps) {
  const isCompleted = task.status === "completed";
  const bucket = priorityBucket(task.priority);
  const isSeeded = task.is_seeded && !isCompleted;
  const isDueUrgent =
    !isCompleted && task.due_date !== null && task.due_date <= getAppToday();
  const isReleased = variant === "released";
  const isEditable = Boolean(onEdit) && !isReleased;

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
          isCompleted && "opacity-50",
        )}
        aria-hidden
      />

      {isReleased ? (
        <span
          className="flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 border-line text-ink-soft/50"
          aria-hidden
        >
          <Waves className="size-[13px]" />
        </span>
      ) : (
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
      )}

      <div
        className={cn("min-w-0 flex-1", isEditable && "cursor-pointer")}
        role={isEditable ? "button" : undefined}
        tabIndex={isEditable ? 0 : -1}
        onClick={isEditable ? () => onEdit?.(task) : undefined}
        onKeyDown={
          isEditable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEdit?.(task);
                }
              }
            : undefined
        }
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight",
              isCompleted && "text-ink-soft line-through decoration-line",
            )}
          >
            {task.title}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-[9px] py-[3px] text-[10.5px] font-extrabold",
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
            {formatDuration(task.duration_minutes)}
          </span>
          <EffortDots level={task.energy_level} />
          {task.due_date && (
            <span
              className={cn(
                "flex items-center gap-[5px]",
                isDueUrgent && "font-bold text-coral",
              )}
            >
              <CalendarDays className="size-3.5" />
              {formatDueDate(task.due_date)}
              {task.due_time ? ` · ${formatDueTime(task.due_time)}` : null}
              {!isCompleted && !isReleased && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadIcs(taskIcsFilename(task), buildTaskIcs(task));
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="ml-0.5 flex items-center justify-center text-ink-soft/60 transition-colors hover:text-sea"
                  aria-label="Додати до календаря"
                >
                  <CalendarPlus className="size-3.5" />
                </button>
              )}
            </span>
          )}
          {projectName && (
            <span className="flex min-w-0 items-center gap-[5px]">
              <Folder className="size-3.5 shrink-0" />
              <span className="truncate">{projectName}</span>
            </span>
          )}
          {isSeeded && (
            <span className="font-bold text-sea-deep">🥚 ікринка</span>
          )}
        </div>
      </div>

      {isReleased && (
        <button
          type="button"
          onClick={() => onRestore?.(task)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-sea-soft px-2.5 py-1.5 text-[11.5px] font-bold text-sea-deep transition-colors hover:bg-sea-soft/70"
        >
          <Undo2 className="size-3.5" />
          Повернути
        </button>
      )}
    </div>
  );
}
