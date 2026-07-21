import { TaskCard } from "@/components/gentle/task-card";
import type { DbTask } from "@/types/gentle";

interface TaskListProps {
  tasks: DbTask[];
  projectNameById?: Map<string, string>;
  onToggleComplete?: (task: DbTask) => void;
  onEditTask?: (task: DbTask) => void;
  emptyMessage?: string;
}

export function TaskList({
  tasks,
  projectNameById,
  onToggleComplete,
  onEditTask,
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
        <TaskCard
          key={task.id}
          task={task}
          projectName={
            task.project_id ? projectNameById?.get(task.project_id) : undefined
          }
          onToggleComplete={onToggleComplete}
          onEdit={onEditTask}
        />
      ))}
    </div>
  );
}
