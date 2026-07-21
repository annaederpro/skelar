"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskList } from "@/components/gentle/task-list";
import { toggleTaskComplete } from "@/app/actions";
import { useResourceStatus } from "@/context/resource-status-context";
import type { DbTask } from "@/types/gentle";

interface TaskViewProps {
  initialTasks: DbTask[];
  emptyMessage?: string;
}

export function TaskView({ initialTasks, emptyMessage }: TaskViewProps) {
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [syncedTasks, setSyncedTasks] = useState(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { isDepleted } = useResourceStatus();
  const router = useRouter();

  // Keep in sync with the server data whenever it's re-fetched (e.g. a
  // router.refresh() triggered by completing a task elsewhere, like Focus
  // mode) — useState only takes its initial value once otherwise.
  if (initialTasks !== syncedTasks) {
    setSyncedTasks(initialTasks);
    setTasks(initialTasks);
  }

  const visibleTasks = useMemo(
    () => (isDepleted ? tasks.filter((task) => task.energy_level < 3) : tasks),
    [tasks, isDepleted],
  );

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

  return (
    <div className="flex flex-col gap-2">
      {errorMessage && (
        <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-sm text-coral">
          {errorMessage}
        </p>
      )}
      <TaskList
        tasks={visibleTasks}
        onToggleComplete={handleToggleComplete}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
