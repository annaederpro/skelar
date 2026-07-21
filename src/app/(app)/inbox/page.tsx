import { createClient } from "@/lib/supabase/server";
import { getAppToday } from "@/lib/date";
import { TaskView } from "@/components/gentle/task-view";
import type { DbTask } from "@/types/gentle";

// No due date first, then due today, then everything else in calendar order.
function dueDateBucket(task: DbTask, today: string): 0 | 1 | 2 {
  if (task.due_date === null) return 0;
  if (task.due_date === today) return 1;
  return 2;
}

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .is("project_id", null)
    .order("created_at", { ascending: false });

  const today = getAppToday();
  const sortedTasks = (tasks ?? []).slice().sort((a, b) => {
    const bucketDiff = dueDateBucket(a, today) - dueDateBucket(b, today);
    if (bucketDiff !== 0) return bucketDiff;
    if (a.due_date !== null && b.due_date !== null && a.due_date !== b.due_date) {
      return a.due_date < b.due_date ? -1 : 1;
    }
    return 0;
  });

  return (
    <TaskView initialTasks={sortedTasks as DbTask[]} emptyMessage="Всі задачі порожні. Гарний знак 🌿" />
  );
}
