"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { DbProject, EnergyLevel, Priority } from "@/types/gentle";
import { ENERGY_DOT_CLASS, PRIORITY_DOT_CLASS, PRIORITY_LABEL } from "@/types/gentle";
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
const PRIORITY_OPTIONS: Priority[] = [1, 2, 3, 4];

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
      <Input
        placeholder="Що потрібно зробити?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

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
                energyLevel === level ? "border-foreground" : "border-transparent",
              )}
              aria-label={`Рівень енергії ${level}`}
            >
              <span className={cn("size-3 rounded-full", ENERGY_DOT_CLASS[level])} />
            </button>
          );
        })}

        <Input
          type="number"
          min={5}
          step={5}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value) || 0)}
          className="ml-2 w-20"
        />
        <span className="text-xs text-muted-foreground">хв</span>
      </div>

      <div className="flex items-center gap-1.5">
        {PRIORITY_OPTIONS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setPriority(level)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border-2 transition-colors",
              priority === level ? "border-foreground" : "border-transparent",
            )}
            aria-label={`Пріоритет ${PRIORITY_LABEL[level]}`}
          >
            <span className={cn("size-3 rounded-full", PRIORITY_DOT_CLASS[level])} />
          </button>
        ))}
        <span className="text-xs text-muted-foreground">{PRIORITY_LABEL[priority]}</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={projectId ?? ""}
          onChange={(e) => setProjectId(e.target.value || null)}
          aria-label="Проєкт"
          className="h-9 flex-1 rounded-md border bg-transparent px-3 text-sm"
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
          className="h-9 rounded-md border bg-transparent px-3 text-sm text-muted-foreground"
        />
      </div>

      <Button type="submit" size="sm" className="w-full rounded-full">
        <Plus className="size-4" />
        Додати
      </Button>
    </form>
  );
}
