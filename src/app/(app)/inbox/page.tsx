import Link from "next/link";
import { Trash2 } from "lucide-react";
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
    .is("released_at", null)
    .order("created_at", { ascending: false });

  const today = getAppToday();
  const sortedTasks = (tasks ?? []).slice().sort((a, b) => {
    const bucketDiff = dueDateBucket(a, today) - dueDateBucket(b, today);
    if (bucketDiff !== 0) return bucketDiff;
    if (a.due_date !== null && b.due_date !== null && a.due_date !== b.due_date) {
      return a.due_date < b.due_date ? -1 : 1;
    }
    if (a.due_time !== b.due_time) {
      if (a.due_time === null) return -1;
      if (b.due_time === null) return 1;
      return a.due_time < b.due_time ? -1 : 1;
    }
    return 0;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Всі задачі</h2>
        <Link
          href="/trash"
          className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:bg-muted/70"
        >
          <Trash2 className="size-3.5" />
          Кошик
        </Link>
      </div>
      <TaskView initialTasks={sortedTasks as DbTask[]} emptyMessage="Всі задачі порожні. Гарний знак 🌿" />
    </div>
  );
}
