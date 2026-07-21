"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { DbProject, EnergyLevel, Priority } from "@/types/gentle";
import {
  EFFORT_WORD,
  priorityBucket,
  PRIORITY_BUCKETS,
  PRIORITY_BUCKET_LABEL,
} from "@/types/gentle";
import { cn } from "@/lib/utils";

interface QuickAddTaskFormProps {
  onAdd: (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
    projectId: string | null;
    priority: Priority;
    dueDate: string | null;
  }) => void;
  disabledEnergyLevels?: EnergyLevel[];
  projects?: DbProject[];
}

const ENERGY_OPTIONS: EnergyLevel[] = [1, 2, 3];

export function QuickAddTaskForm({
  onAdd,
  disabledEnergyLevels = [],
  projects = [],
}: QuickAddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(1);
  const [duration, setDuration] = useState(30);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>(4);
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    onAdd({
      title: trimmed,
      energyLevel,
      durationMinutes: duration,
      projectId,
      priority,
      dueDate: dueDate || null,
    });
    setTitle("");
    setEnergyLevel(1);
    setDuration(30);
    setProjectId(null);
    setPriority(4);
    setDueDate("");
  };

  const activeBucket = priorityBucket(priority);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-3"
    >
      <Input
        placeholder="Що потрібно зробити?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
              onClick={() => setEnergyLevel(level)}
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
          type="number"
          min={5}
          step={5}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value) || 0)}
          className="ml-2 w-20"
        />
        <span className="text-xs text-ink-soft">хв</span>
      </div>

      {/* priority — 3 human buckets */}
      <div className="flex items-center gap-2">
        {PRIORITY_BUCKETS.map(({ bucket, value }) => (
          <button
            key={bucket}
            type="button"
            onClick={() => setPriority(value)}
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

      <div className="flex items-center gap-2">
        <select
          value={projectId ?? ""}
          onChange={(e) => setProjectId(e.target.value || null)}
          aria-label="Проєкт"
          className="h-9 flex-1 rounded-md border border-line bg-transparent px-3 text-sm"
        >
          <option value="">Inbox</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Дата виконання"
          className="h-9 rounded-md border border-line bg-transparent px-3 text-sm text-ink-soft"
        />
      </div>

      <Button type="submit" size="sm" className="w-full rounded-full">
        <Plus className="size-4" />
        Додати
      </Button>
    </form>
  );
}
