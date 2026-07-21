"use client";

import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DbProject, EnergyLevel, Priority } from "@/types/gentle";
import {
  EFFORT_WORD,
  priorityBucket,
  PRIORITY_BUCKETS,
  PRIORITY_BUCKET_LABEL,
  type DurationUnit,
} from "@/types/gentle";
import { cn } from "@/lib/utils";

interface TaskFieldsFormProps {
  title: string;
  onTitleChange: (value: string) => void;
  energyLevel: EnergyLevel;
  onEnergyLevelChange: (value: EnergyLevel) => void;
  disabledEnergyLevels?: EnergyLevel[];
  durationValue: string;
  onDurationValueChange: (value: string) => void;
  durationUnit: DurationUnit;
  onDurationUnitChange: (unit: DurationUnit) => void;
  priority: Priority;
  onPriorityChange: (value: Priority) => void;
  projectId: string | null;
  onProjectIdChange: (value: string | null) => void;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  projects: DbProject[];
}

const ENERGY_OPTIONS: EnergyLevel[] = [1, 2, 3];

// The editable field set shared by "create a task" (QuickAddTaskForm's
// review step) and "edit an existing task" (EditTaskDialog) — title,
// effort/duration, priority, project, and due date. Fully controlled so
// both callers own their own state and submit behavior.
export function TaskFieldsForm({
  title,
  onTitleChange,
  energyLevel,
  onEnergyLevelChange,
  disabledEnergyLevels = [],
  durationValue,
  onDurationValueChange,
  durationUnit,
  onDurationUnitChange,
  priority,
  onPriorityChange,
  projectId,
  onProjectIdChange,
  dueDate,
  onDueDateChange,
  projects,
}: TaskFieldsFormProps) {
  const activeBucket = priorityBucket(priority);

  return (
    <>
      <Input
        placeholder="Що потрібно зробити?"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        autoFocus
      />

      {/* effort (energy) */}
      <div className="flex items-center gap-1.5">
        {ENERGY_OPTIONS.map((level) => {
          const isDisabled = disabledEnergyLevels.includes(level);
          return (
            <button
              key={level}
              type="button"
              disabled={isDisabled}
              onClick={() => onEnergyLevelChange(level)}
              className={cn(
                "flex size-8 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                energyLevel === level ? "border-sea" : "border-transparent",
              )}
              aria-label={`Зусилля: ${EFFORT_WORD[level]}`}
            >
              <span
                className={cn(
                  "size-3 rounded-full",
                  level <= energyLevel ? "bg-sea" : "bg-line",
                )}
              />
            </button>
          );
        })}
        <span className="text-xs text-ink-soft">{EFFORT_WORD[energyLevel]}</span>

        <Input
          type="text"
          inputMode="decimal"
          value={durationValue}
          onChange={(e) => onDurationValueChange(e.target.value)}
          aria-label="Тривалість"
          className="ml-2 w-16"
        />
        <div className="flex gap-1 rounded-full bg-muted p-0.5 text-xs font-bold">
          {(["min", "hour"] as const).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => onDurationUnitChange(unit)}
              aria-pressed={durationUnit === unit}
              className={cn(
                "rounded-full px-2.5 py-1 transition-colors",
                durationUnit === unit ? "bg-card text-ink" : "text-ink-soft",
              )}
            >
              {unit === "min" ? "хв" : "год"}
            </button>
          ))}
        </div>
      </div>

      {/* priority — 3 human buckets */}
      <div className="flex items-center gap-2">
        {PRIORITY_BUCKETS.map(({ bucket, value }) => (
          <button
            key={bucket}
            type="button"
            onClick={() => onPriorityChange(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
              activeBucket === bucket
                ? "border-sea bg-sea-soft text-sea-deep"
                : "border-line bg-card text-ink-soft",
            )}
            aria-label={`Пріоритет: ${PRIORITY_BUCKET_LABEL[bucket]}`}
            aria-pressed={activeBucket === bucket}
          >
            {PRIORITY_BUCKET_LABEL[bucket]}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="px-0.5 text-[11px] font-bold text-ink-soft">Проєкт</span>
          <select
            value={projectId ?? ""}
            onChange={(e) => onProjectIdChange(e.target.value || null)}
            aria-label="Проєкт"
            className="h-9 min-w-0 rounded-md border border-line bg-transparent px-3 text-sm"
          >
            <option value="">Всі задачі</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <span className="px-0.5 text-[11px] font-bold text-ink-soft">Дата виконання</span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft" />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              aria-label="Дата виконання"
              className="h-9 w-[140px] rounded-md border border-line bg-transparent py-2 pl-8 pr-2 text-sm text-ink-soft"
            />
          </div>
        </div>
      </div>
    </>
  );
}
