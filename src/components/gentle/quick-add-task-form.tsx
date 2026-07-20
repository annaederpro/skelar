"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { EnergyLevel } from "@/types/gentle";
import { ENERGY_DOT_CLASS } from "@/types/gentle";
import { cn } from "@/lib/utils";

interface QuickAddTaskFormProps {
  onAdd: (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
  }) => void;
  disabledEnergyLevels?: EnergyLevel[];
}

const ENERGY_OPTIONS: EnergyLevel[] = [1, 2, 3];

export function QuickAddTaskForm({
  onAdd,
  disabledEnergyLevels = [],
}: QuickAddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(1);
  const [duration, setDuration] = useState(30);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    onAdd({ title: trimmed, energyLevel, durationMinutes: duration });
    setTitle("");
    setEnergyLevel(1);
    setDuration(30);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-3"
    >
      <Input
        placeholder="Що потрібно зробити?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="flex items-center justify-between gap-3">
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
                  energyLevel === level
                    ? "border-foreground"
                    : "border-transparent",
                )}
                aria-label={`Рівень енергії ${level}`}
              >
                <span
                  className={cn("size-3 rounded-full", ENERGY_DOT_CLASS[level])}
                />
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

        <Button type="submit" size="sm" className="rounded-full">
          <Plus className="size-4" />
          Додати
        </Button>
      </div>
    </form>
  );
}
