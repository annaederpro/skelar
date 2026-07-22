"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteProject, updateProjectName } from "@/app/actions";
import {
  Popover,
  PopoverPortal,
  PopoverPositioner,
  PopoverPopup,
} from "@/components/ui/popover";

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
    "shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-[7px] text-[12.5px] font-bold transition-colors select-none [-webkit-touch-callout:none] [-webkit-user-select:none]",
    isActive
      ? "border-sea bg-sea-soft text-sea-deep"
      : "border-line bg-card text-ink-soft hover:text-ink",
  );

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

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
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  const skipBlurSaveRef = useRef(false);

  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  };

  const handleChipPointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    projectId: string,
  ) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    const target = e.currentTarget;
    pressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      anchorRef.current = target;
      setMenuProjectId(projectId);
    }, LONG_PRESS_MS);
  };

  const handleChipPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pressStart.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearPressTimer();
  };

  const handleChipClick = (projectId: string) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    onSelectFilter(projectId);
  };

  const activeMenuProject = projects.find((p) => p.id === menuProjectId) ?? null;

  const handleEditFromMenu = () => {
    if (!activeMenuProject) return;
    setEditingProjectId(activeMenuProject.id);
    setRenameValue(activeMenuProject.name);
    setMenuProjectId(null);
  };

  const handleDeleteFromMenu = () => {
    if (!activeMenuProject) return;
    const project = activeMenuProject;
    setMenuProjectId(null);
    if (!window.confirm(`Видалити проєкт «${project.name}»? Задачі залишаться без проєкту.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (!("error" in result)) {
        if (projectFilter === project.id) onSelectFilter("all");
        router.refresh();
      }
    });
  };

  const saveRename = (project: { id: string; name: string }) => {
    const trimmed = renameValue.trim();
    setEditingProjectId(null);
    if (!trimmed || trimmed === project.name) return;
    startTransition(async () => {
      const result = await updateProjectName(project.id, trimmed);
      if (!("error" in result)) router.refresh();
    });
  };

  return (
    <>
      <div
        className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            {projects.map((project) =>
              editingProjectId === project.id ? (
                <input
                  key={project.id}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => {
                    if (skipBlurSaveRef.current) {
                      skipBlurSaveRef.current = false;
                      return;
                    }
                    saveRename(project);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveRename(project);
                    } else if (e.key === "Escape") {
                      skipBlurSaveRef.current = true;
                      setEditingProjectId(null);
                    }
                  }}
                  autoFocus
                  aria-label={`Назва проєкту ${project.name}`}
                  className={cn(chipClass(true), "w-28 outline-none")}
                />
              ) : (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleChipClick(project.id)}
                  onPointerDown={(e) => handleChipPointerDown(e, project.id)}
                  onPointerMove={handleChipPointerMove}
                  onPointerUp={clearPressTimer}
                  onPointerLeave={clearPressTimer}
                  onPointerCancel={clearPressTimer}
                  aria-pressed={projectFilter === project.id}
                  className={chipClass(projectFilter === project.id)}
                >
                  {project.name}
                </button>
              ),
            )}
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

      <Popover
        open={menuProjectId !== null}
        onOpenChange={(open) => !open && setMenuProjectId(null)}
      >
        <PopoverPortal>
          <PopoverPositioner anchor={anchorRef} side="bottom" align="start">
            <PopoverPopup>
              <button
                type="button"
                onClick={handleEditFromMenu}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-ink hover:bg-muted"
              >
                <Pencil className="size-4" />
                Редагувати
              </button>
              <button
                type="button"
                onClick={handleDeleteFromMenu}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-coral hover:bg-coral-soft/60"
              >
                <Trash2 className="size-4" />
                Видалити
              </button>
            </PopoverPopup>
          </PopoverPositioner>
        </PopoverPortal>
      </Popover>
    </>
  );
}
