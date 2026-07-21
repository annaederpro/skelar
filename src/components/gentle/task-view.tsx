"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TaskList } from "@/components/gentle/task-list";
import { ProjectFilterBar, type ProjectFilter } from "@/components/gentle/project-filter-bar";
import { EditTaskDialog } from "@/components/gentle/edit-task-dialog";
import { toggleTaskComplete, createProject } from "@/app/actions";
import { useResourceStatus } from "@/context/resource-status-context";
import { useProjects } from "@/context/projects-context";
import { priorityBucket } from "@/types/gentle";
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
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingTask, setEditingTask] = useState<DbTask | null>(null);
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

  return (
    <div className="flex flex-col gap-2">
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
        emptyMessage={
          projectFilter !== "all" && tasks.length > 0
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
    </div>
  );
}
