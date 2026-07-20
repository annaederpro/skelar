"use client";

import { useMemo, useState } from "react";
import { ResourceStatusToggle } from "@/components/gentle/resource-status-toggle";
import { DepletedBanner } from "@/components/gentle/depleted-banner";
import { TaskList } from "@/components/gentle/task-list";
import { QuickAddTaskForm } from "@/components/gentle/quick-add-task-form";
import type { DbTask, EnergyLevel, ResourceStatus } from "@/types/gentle";

// Seed data for local development before Supabase auth/data fetching is wired up.
const SEED_TASKS: DbTask[] = [
  {
    id: "1",
    user_id: "demo",
    title: "Відповісти на важливі листи",
    status: "todo",
    energy_level: 1,
    duration_minutes: 15,
    is_backlog: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    user_id: "demo",
    title: "Підготувати презентацію для клієнта",
    status: "todo",
    energy_level: 3,
    duration_minutes: 90,
    is_backlog: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    user_id: "demo",
    title: "Розібрати вхідні в таск-трекері",
    status: "todo",
    energy_level: 2,
    duration_minutes: 30,
    is_backlog: false,
    created_at: new Date().toISOString(),
  },
];

export default function HomePage() {
  const [resourceStatus, setResourceStatus] = useState<ResourceStatus>("normal");
  const [tasks, setTasks] = useState<DbTask[]>(SEED_TASKS);

  const isDepleted = resourceStatus === "depleted";

  const visibleTasks = useMemo(
    () =>
      isDepleted ? tasks.filter((task) => task.energy_level < 3) : tasks,
    [tasks, isDepleted],
  );

  const handleToggleComplete = (task: DbTask) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: t.status === "completed" ? "todo" : "completed" }
          : t,
      ),
    );
  };

  const handleAddTask = (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
  }) => {
    const newTask: DbTask = {
      id: crypto.randomUUID(),
      user_id: "demo",
      title: input.title,
      status: "todo",
      energy_level: input.energyLevel,
      duration_minutes: input.durationMinutes,
      is_backlog: false,
      created_at: new Date().toISOString(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 bg-background px-4 py-6">
      <header className="flex flex-col items-center gap-4">
        <h1 className="text-lg font-semibold">Сьогодні</h1>
        <ResourceStatusToggle value={resourceStatus} onChange={setResourceStatus} />
      </header>

      {isDepleted && <DepletedBanner />}

      <section className="flex flex-col gap-2">
        <TaskList tasks={visibleTasks} onToggleComplete={handleToggleComplete} />
      </section>

      <section className="mt-auto">
        <QuickAddTaskForm
          onAdd={handleAddTask}
          disabledEnergyLevels={isDepleted ? [3] : []}
        />
      </section>
    </main>
  );
}
