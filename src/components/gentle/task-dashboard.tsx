"use client";

import { useMemo, useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { ResourceStatusToggle } from "@/components/gentle/resource-status-toggle";
import { DepletedBanner } from "@/components/gentle/depleted-banner";
import { TaskList } from "@/components/gentle/task-list";
import { QuickAddTaskForm } from "@/components/gentle/quick-add-task-form";
import { addTask, toggleTaskComplete, updateResourceStatus, signOut } from "@/app/actions";
import type { DbTask, EnergyLevel, ResourceStatus } from "@/types/gentle";

interface TaskDashboardProps {
  initialTasks: DbTask[];
  initialResourceStatus: ResourceStatus;
}

export function TaskDashboard({ initialTasks, initialResourceStatus }: TaskDashboardProps) {
  const [resourceStatus, setResourceStatus] = useState<ResourceStatus>(initialResourceStatus);
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isDepleted = resourceStatus === "depleted";

  const visibleTasks = useMemo(
    () => (isDepleted ? tasks.filter((task) => task.energy_level < 3) : tasks),
    [tasks, isDepleted],
  );

  const handleResourceStatusChange = (next: ResourceStatus) => {
    const previous = resourceStatus;
    setResourceStatus(next);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await updateResourceStatus(next);
      if ("error" in result) {
        setResourceStatus(previous);
        setErrorMessage(result.error);
      }
    });
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
      }
    });
  };

  const handleAddTask = (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
  }) => {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await addTask(input);
      if ("error" in result) {
        setErrorMessage(result.error);
        return;
      }
      setTasks((prev) => [result.task, ...prev]);
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 bg-background px-4 py-6">
      <header className="flex flex-col items-center gap-4">
        <div className="flex w-full items-center justify-between">
          <span className="size-5" aria-hidden />
          <h1 className="text-lg font-semibold">Сьогодні</h1>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Вийти"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-5" />
            </button>
          </form>
        </div>
        <ResourceStatusToggle value={resourceStatus} onChange={handleResourceStatusChange} />
      </header>

      {isDepleted && <DepletedBanner />}

      {errorMessage && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
          {errorMessage}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <TaskList tasks={visibleTasks} onToggleComplete={handleToggleComplete} />
      </section>

      <section className="mt-auto">
        <QuickAddTaskForm onAdd={handleAddTask} disabledEnergyLevels={isDepleted ? [3] : []} />
      </section>
    </main>
  );
}
