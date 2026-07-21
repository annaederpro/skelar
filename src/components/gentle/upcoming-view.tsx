"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskList } from "@/components/gentle/task-list";
import { WeekStrip } from "@/components/gentle/week-strip";
import { ProjectFilterBar, type ProjectFilter } from "@/components/gentle/project-filter-bar";
import { toggleTaskComplete, createProject } from "@/app/actions";
import { useProjects } from "@/context/projects-context";
import { getAppToday } from "@/lib/date";
import type { DbTask } from "@/types/gentle";

interface UpcomingViewProps {
  initialTasks: DbTask[];
  emptyMessage?: string;
}

export function UpcomingView({ initialTasks, emptyMessage }: UpcomingViewProps) {
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [syncedTasks, setSyncedTasks] = useState(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [, startTransition] = useTransition();
  const projects = useProjects();
  const router = useRouter();
  const today = getAppToday();
  const listTopRef = useRef<HTMLDivElement>(null);

  if (initialTasks !== syncedTasks) {
    setSyncedTasks(initialTasks);
    setTasks(initialTasks);
  }

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const visibleTasks = useMemo(() => {
    if (projectFilter === "none") return tasks.filter((t) => t.project_id === null);
    if (projectFilter !== "all") return tasks.filter((t) => t.project_id === projectFilter);
    return tasks;
  }, [tasks, projectFilter]);

  const busyDates = useMemo(() => {
    const set = new Set<string>();
    for (const task of visibleTasks) {
      if (task.status !== "completed" && task.due_date) set.add(task.due_date);
    }
    return set;
  }, [visibleTasks]);

  const handleSelectDate = (date: string) => {
    if (date < today) {
      document.getElementById("overdue-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (date === today) {
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      document.getElementById(`day-${date}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
      <WeekStrip today={today} busyDates={busyDates} onSelectDate={handleSelectDate} />
      {errorMessage && (
        <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-sm text-coral">
          {errorMessage}
        </p>
      )}
      <div ref={listTopRef} />
      <TaskList
        tasks={visibleTasks}
        projectNameById={projectNameById}
        onToggleComplete={handleToggleComplete}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
