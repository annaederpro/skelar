"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Check } from "lucide-react";
import type { DbTask } from "@/types/gentle";
import { ENERGY_BADGE_CLASS, ENERGY_DOT_CLASS } from "@/types/gentle";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: DbTask;
  onToggleComplete?: (task: DbTask) => void;
}

export function TaskCard({ task, onToggleComplete }: TaskCardProps) {
  const isCompleted = task.status === "completed";

  return (
    <Card
      className={cn(
        "flex flex-row items-center gap-3 rounded-2xl border-none p-3 shadow-sm transition-opacity",
        isCompleted && "opacity-50",
      )}
    >
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          ENERGY_DOT_CLASS[task.energy_level],
        )}
        aria-hidden
      />

      <button
        type="button"
        onClick={() => onToggleComplete?.(task)}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isCompleted
            ? "border-emerald-400 bg-emerald-400 text-white"
            : "border-muted-foreground/30 text-transparent hover:border-emerald-400",
        )}
        aria-label={isCompleted ? "Позначити як невиконану" : "Позначити як виконану"}
      >
        <Check className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            isCompleted && "line-through",
          )}
        >
          {task.title}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          <span>{task.duration_minutes} хв</span>
        </div>
      </div>

      <Badge
        variant="outline"
        className={cn("shrink-0 rounded-full", ENERGY_BADGE_CLASS[task.energy_level])}
      >
        {"⚡️".repeat(task.energy_level)}
      </Badge>
    </Card>
  );
}
