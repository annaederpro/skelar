import { createClient } from "@/lib/supabase/server";
import { TaskView } from "@/components/gentle/task-view";
import type { DbTask } from "@/types/gentle";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("due_date", today)
    .order("created_at", { ascending: false });

  return (
    <TaskView
      initialTasks={(tasks ?? []) as DbTask[]}
      emptyMessage="На сьогодні задач немає. Саме час відпочити 🌿"
    />
  );
}
