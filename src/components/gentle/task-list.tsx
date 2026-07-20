import { TaskCard } from "@/components/gentle/task-card";
import type { DbTask } from "@/types/gentle";

interface TaskListProps {
  tasks: DbTask[];
  onToggleComplete?: (task: DbTask) => void;
  emptyMessage?: string;
}

export function TaskList({
  tasks,
  onToggleComplete,
  emptyMessage = "Задач на сьогодні поки немає. Саме час відпочити 🌿",
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onToggleComplete={onToggleComplete} />
      ))}
    </div>
  );
}
