"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TaskList } from "@/components/gentle/task-list";
import { ProjectFilterBar, type ProjectFilter } from "@/components/gentle/project-filter-bar";
import { TaskStatusFilterBar, type StatusFilter } from "@/components/gentle/task-status-filter-bar";
import { EditTaskDialog } from "@/components/gentle/edit-task-dialog";
import { toggleTaskComplete, createProject, releaseTask, restoreTask } from "@/app/actions";
import { ReleaseToast } from "@/components/gentle/release-toast";
import { useResourceStatus } from "@/context/resource-status-context";
import { useProjects } from "@/context/projects-context";
import { priorityBucket, compareTasksForAllTasksTab } from "@/types/gentle";
import type { DbTask } from "@/types/gentle";

interface TaskViewProps {
  initialTasks: DbTask[];
  emptyMessage?: string;
}

export function TaskView({ initialTasks, emptyMessage }: TaskViewProps) {
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [syncedTasks, setSyncedTasks] = useState(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingTask, setEditingTask] = useState<DbTask | null>(null);
  const [releasedTask, setReleasedTask] = useState<{ id: string; title: string } | null>(null);
  const [, startTransition] = useTransition();
  const { isDepleted } = useResourceStatus();
  const projects = useProjects();
  const router = useRouter();
  const pathname = usePathname();
  // The energy-based filter (hide deep-effort tasks) applies only on Сьогодні —
  // other tabs show everything regardless of today's energy level.
  const applyDepletedFilter = isDepleted && (pathname === "/today" || pathname.startsWith("/today/"));
  // Importance sort + Виконані filter apply only on "Всі задачі" — /today
  // already excludes completed tasks at the query level, and /browse's
  // project pages keep their existing created_at order.
  const isAllTasksTab = pathname === "/inbox";

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
    if (isAllTasksTab) {
      if (statusFilter === "completed") {
        list = list.filter((task) => task.status === "completed");
      }
      // .slice() first: list may still be the same array reference as
      // `tasks` (no depleted/project filter applied) — sorting in place
      // would mutate component state.
      list = list.slice().sort(compareTasksForAllTasksTab);
    }
    return list;
  }, [tasks, applyDepletedFilter, projectFilter, isAllTasksTab, statusFilter]);

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

  const handleRelease = (task: DbTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await releaseTask(task.id);
      if ("error" in result) {
        setTasks((prev) => [task, ...prev]);
        setErrorMessage(result.error);
        return;
      }
      setReleasedTask({ id: task.id, title: task.title });
      router.refresh();
    });
  };

  const handleUndoRelease = () => {
    if (!releasedTask) return;
    const id = releasedTask.id;
    setReleasedTask(null);
    startTransition(async () => {
      const result = await restoreTask(id);
      if ("error" in result) {
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

  return (
    <div className="flex flex-col gap-2">
      {isAllTasksTab && (
        <TaskStatusFilterBar statusFilter={statusFilter} onSelectFilter={setStatusFilter} />
      )}
      <ProjectFilterBar
        projects={projects}
        projectFilter={projectFilter}
        onSelectFilter={setProjectFilter}
        isCreatingProject={isCreatingProject}
        onToggleCreating={() => setIsCreatingProject((v) => !v)}
        newProjectName={newProjectName}
        onNewProjectNameChange={setNewProjectName}
        onCreateProject={handleCreateProject}
      />

      {errorMessage && (
        <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-sm text-coral">
          {errorMessage}
        </p>
      )}
      <TaskList
        tasks={visibleTasks}
        projectNameById={projectNameById}
        onToggleComplete={handleToggleComplete}
        onEditTask={setEditingTask}
        onReleaseTask={handleRelease}
        emptyMessage={
          isAllTasksTab && statusFilter === "completed"
            ? "Ще немає виконаних задач 🌿"
            : projectFilter !== "all" && tasks.length > 0
              ? "У цьому проєкті поки порожньо 🌊"
              : emptyMessage
        }
      />
      <EditTaskDialog
        key={editingTask?.id ?? "none"}
        task={editingTask}
        projects={projects}
        onOpenChange={(open) => {
          if (!open) setEditingTask(null);
        }}
        onSaved={() => {
          setEditingTask(null);
          router.refresh();
        }}
      />
      <ReleaseToast
        task={releasedTask}
        onUndo={handleUndoRelease}
        onDismiss={() => setReleasedTask(null)}
      />
    </div>
  );
}
