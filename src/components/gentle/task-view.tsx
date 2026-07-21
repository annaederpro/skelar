"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Plus, Check } from "lucide-react";
import { TaskList } from "@/components/gentle/task-list";
import { toggleTaskComplete, createProject } from "@/app/actions";
import { useResourceStatus } from "@/context/resource-status-context";
import { useProjects } from "@/context/projects-context";
import { priorityBucket } from "@/types/gentle";
import type { DbTask } from "@/types/gentle";
import { cn } from "@/lib/utils";

interface TaskViewProps {
  initialTasks: DbTask[];
  emptyMessage?: string;
}

// "all" shows everything, "none" shows tasks without a project, otherwise a project id.
type ProjectFilter = "all" | "none" | string;

export function TaskView({ initialTasks, emptyMessage }: TaskViewProps) {
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [syncedTasks, setSyncedTasks] = useState(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [, startTransition] = useTransition();
  const { isDepleted } = useResourceStatus();
  const projects = useProjects();
  const router = useRouter();
  const pathname = usePathname();
  // The energy-based filter (hide deep-effort tasks) applies only on Сьогодні —
  // other tabs show everything regardless of today's energy level.
  const applyDepletedFilter = isDepleted && (pathname === "/today" || pathname.startsWith("/today/"));

  // Keep in sync with the server data whenever it's re-fetched (e.g. a
  // router.refresh() triggered by completing a task elsewhere, like Focus
  // mode) — useState only takes its initial value once otherwise.
  if (initialTasks !== syncedTasks) {
    setSyncedTasks(initialTasks);
    setTasks(initialTasks);
  }

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const visibleTasks = useMemo(() => {
    // Depleted days hide deep-effort tasks — but never important ones:
    // a "Важливо" task stays visible regardless of how heavy it is.
    let list = applyDepletedFilter
      ? tasks.filter(
          (task) => task.energy_level < 3 || priorityBucket(task.priority) === "high",
        )
      : tasks;
    if (projectFilter === "none") {
      list = list.filter((task) => task.project_id === null);
    } else if (projectFilter !== "all") {
      list = list.filter((task) => task.project_id === projectFilter);
    }
    return list;
  }, [tasks, applyDepletedFilter, projectFilter]);

  const handleToggleComplete = (task: DbTask) => {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await toggleTaskComplete(task.id, nextStatus);
      if ("error" in result) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    const result = await createProject(trimmed);
    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }
    setNewProjectName("");
    setIsCreatingProject(false);
    setProjectFilter(result.project.id);
    router.refresh();
  };

  const chipClass = (isActive: boolean) =>
    cn(
      "shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-[7px] text-[12.5px] font-bold transition-colors",
      isActive
        ? "border-sea bg-sea-soft text-sea-deep"
        : "border-line bg-card text-ink-soft hover:text-ink",
    );

  return (
    <div className="flex flex-col gap-2">
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Фільтр за проєктом"
      >
        {projects.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setProjectFilter("all")}
              aria-pressed={projectFilter === "all"}
              className={chipClass(projectFilter === "all")}
            >
              Усі
            </button>
            <button
              type="button"
              onClick={() => setProjectFilter("none")}
              aria-pressed={projectFilter === "none"}
              className={chipClass(projectFilter === "none")}
            >
              Без проєкту
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setProjectFilter(project.id)}
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
          onClick={() => setIsCreatingProject((v) => !v)}
          aria-expanded={isCreatingProject}
          className={cn(chipClass(false), "flex items-center gap-1")}
        >
          <Plus className="size-3.5" />
          {projects.length === 0 && "Проєкт"}
        </button>
      </div>

      {isCreatingProject && (
        <form onSubmit={handleCreateProject} className="flex items-center gap-2">
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
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

      {errorMessage && (
        <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-sm text-coral">
          {errorMessage}
        </p>
      )}
      <TaskList
        tasks={visibleTasks}
        projectNameById={projectNameById}
        onToggleComplete={handleToggleComplete}
        emptyMessage={
          projectFilter !== "all" && tasks.length > 0
            ? "У цьому проєкті поки порожньо 🌊"
            : emptyMessage
        }
      />
    </div>
  );
}
