"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskList } from "@/components/gentle/task-list";
import { WeekStrip } from "@/components/gentle/week-strip";
import { ProjectFilterBar, type ProjectFilter } from "@/components/gentle/project-filter-bar";
import { toggleTaskComplete, createProject } from "@/app/actions";
import { useProjects } from "@/context/projects-context";
import { getAppToday } from "@/lib/date";
import { formatDayHeader } from "@/lib/upcoming-date";
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

  const overdueTasks = useMemo(
    () => visibleTasks.filter((t) => t.due_date !== null && t.due_date < today),
    [visibleTasks, today],
  );

  const groupedUpcoming = useMemo(() => {
    const map = new Map<string, DbTask[]>();
    for (const task of visibleTasks) {
      if (task.due_date === null || task.due_date <= today) continue;
      const group = map.get(task.due_date) ?? [];
      group.push(task);
      map.set(task.due_date, group);
    }
    return map; // insertion order matches ascending due_date since visibleTasks is pre-sorted by the query
  }, [visibleTasks, today]);

  const handleSelectDate = (date: string) => {
    if (date < today) {
      document.getElementById("overdue-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (date === today) {
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    // Sparse list: if this exact date has no section, jump to the closest
    // later date that does, so clicking an empty day still goes somewhere.
    const target = groupedUpcoming.has(date)
      ? date
      : Array.from(groupedUpcoming.keys()).find((d) => d > date);
    if (target) {
      document.getElementById(`day-${target}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      {overdueTasks.length === 0 && groupedUpcoming.size === 0 ? (
        <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <>
          {overdueTasks.length > 0 && (
            <section id="overdue-section" className="flex flex-col gap-2">
              <h2 className="px-1 text-[13px] font-bold text-coral">Прострочено</h2>
              <TaskList
                tasks={overdueTasks}
                projectNameById={projectNameById}
                onToggleComplete={handleToggleComplete}
              />
            </section>
          )}
          <div ref={listTopRef} />
          {Array.from(groupedUpcoming.entries()).map(([date, dayTasks]) => (
            <section key={date} id={`day-${date}`} className="flex flex-col gap-2">
              <h2 className="px-1 text-[13px] font-bold text-ink-soft">
                {formatDayHeader(date, today)}
              </h2>
              <TaskList
                tasks={dayTasks}
                projectNameById={projectNameById}
                onToggleComplete={handleToggleComplete}
              />
            </section>
          ))}
        </>
      )}
    </div>
  );
}
