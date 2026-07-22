import { TaskCard } from "@/components/gentle/task-card";
import { SwipeToRelease } from "@/components/gentle/swipe-to-release";
import type { DbTask } from "@/types/gentle";

interface TaskListProps {
  tasks: DbTask[];
  projectNameById?: Map<string, string>;
  mode?: "active" | "released";
  onToggleComplete?: (task: DbTask) => void;
  onEditTask?: (task: DbTask) => void;
  onReleaseTask?: (task: DbTask) => void;
  onRestoreTask?: (task: DbTask) => void;
  emptyMessage?: string;
}

export function TaskList({
  tasks,
  projectNameById,
  mode = "active",
  onToggleComplete,
  onEditTask,
  onReleaseTask,
  onRestoreTask,
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
      {tasks.map((task) => {
        const card = (
          <TaskCard
            task={task}
            variant={mode}
            projectName={
              task.project_id ? projectNameById?.get(task.project_id) : undefined
            }
            onToggleComplete={mode === "active" ? onToggleComplete : undefined}
            onEdit={mode === "active" ? onEditTask : undefined}
            onRestore={mode === "released" ? onRestoreTask : undefined}
          />
        );

        if (mode === "released" || !onReleaseTask) {
          return <div key={task.id}>{card}</div>;
        }

        return (
          <SwipeToRelease key={task.id} onRelease={() => onReleaseTask(task)}>
            {card}
          </SwipeToRelease>
        );
      })}
    </div>
  );
}
