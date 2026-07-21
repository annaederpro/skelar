"use client";

import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// "all" shows everything, "none" shows tasks without a project, otherwise a project id.
export type ProjectFilter = "all" | "none" | string;

interface ProjectFilterBarProps {
  projects: { id: string; name: string }[];
  projectFilter: ProjectFilter;
  onSelectFilter: (filter: ProjectFilter) => void;
  isCreatingProject: boolean;
  onToggleCreating: () => void;
  newProjectName: string;
  onNewProjectNameChange: (value: string) => void;
  onCreateProject: (e: React.FormEvent) => void;
}

const chipClass = (isActive: boolean) =>
  cn(
    "shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-[7px] text-[12.5px] font-bold transition-colors",
    isActive
      ? "border-sea bg-sea-soft text-sea-deep"
      : "border-line bg-card text-ink-soft hover:text-ink",
  );

export function ProjectFilterBar({
  projects,
  projectFilter,
  onSelectFilter,
  isCreatingProject,
  onToggleCreating,
  newProjectName,
  onNewProjectNameChange,
  onCreateProject,
}: ProjectFilterBarProps) {
  return (
    <>
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Фільтр за проєктом"
      >
        {projects.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => onSelectFilter("all")}
              aria-pressed={projectFilter === "all"}
              className={chipClass(projectFilter === "all")}
            >
              Усі
            </button>
            <button
              type="button"
              onClick={() => onSelectFilter("none")}
              aria-pressed={projectFilter === "none"}
              className={chipClass(projectFilter === "none")}
            >
              Без проєкту
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectFilter(project.id)}
                aria-pressed={projectFilter === project.id}
                className={chipClass(projectFilter === project.id)}
              >
                {project.name}
              </button>
            ))}
          </>
        )}
        <button
          type="button"
          onClick={onToggleCreating}
          aria-expanded={isCreatingProject}
          className={cn(chipClass(false), "flex items-center gap-1")}
        >
          <Plus className="size-3.5" />
          {projects.length === 0 && "Проєкт"}
        </button>
      </div>

      {isCreatingProject && (
        <form onSubmit={onCreateProject} className="flex items-center gap-2">
          <input
            value={newProjectName}
            onChange={(e) => onNewProjectNameChange(e.target.value)}
            placeholder="Назва нового проєкту"
            autoFocus
            aria-label="Назва нового проєкту"
            className="h-9 min-w-0 flex-1 rounded-full border border-line bg-card px-4 text-sm"
          />
          <button
            type="submit"
            aria-label="Створити проєкт"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sea text-white transition-colors hover:bg-sea-deep"
          >
            <Check className="size-4" />
          </button>
        </form>
      )}
    </>
  );
}
