"use client";

import { chipClass } from "@/components/gentle/project-filter-bar";

export type StatusFilter = "all" | "completed";

interface TaskStatusFilterBarProps {
  statusFilter: StatusFilter;
  onSelectFilter: (filter: StatusFilter) => void;
}

export function TaskStatusFilterBar({ statusFilter, onSelectFilter }: TaskStatusFilterBarProps) {
  return (
    <div
      className="-mx-1 flex items-center gap-2 px-1"
      role="group"
      aria-label="Фільтр за статусом"
    >
      <button
        type="button"
        onClick={() => onSelectFilter("all")}
        aria-pressed={statusFilter === "all"}
        className={chipClass(statusFilter === "all")}
      >
        Усі
      </button>
      <button
        type="button"
        onClick={() => onSelectFilter("completed")}
        aria-pressed={statusFilter === "completed"}
        className={chipClass(statusFilter === "completed")}
      >
        Виконані
      </button>
    </div>
  );
}
