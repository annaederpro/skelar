"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskList } from "@/components/gentle/task-list";
import { restoreTask } from "@/app/actions";
import type { DbTask } from "@/types/gentle";

interface TrashViewProps {
  initialTasks: DbTask[];
}

export function TrashView({ initialTasks }: TrashViewProps) {
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [syncedTasks, setSyncedTasks] = useState(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (initialTasks !== syncedTasks) {
    setSyncedTasks(initialTasks);
    setTasks(initialTasks);
  }

  const handleRestore = (task: DbTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await restoreTask(task.id);
      if ("error" in result) {
        setTasks((prev) => [task, ...prev]);
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
        tasks={tasks}
        mode="released"
        onRestoreTask={handleRestore}
        emptyMessage="Тут поки порожньо — жодної відпущеної задачі."
      />
    </div>
  );
}
