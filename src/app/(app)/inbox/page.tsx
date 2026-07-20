import { createClient } from "@/lib/supabase/server";
import { TaskView } from "@/components/gentle/task-view";
import type { DbTask } from "@/types/gentle";

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

  return (
    <TaskView initialTasks={(tasks ?? []) as DbTask[]} emptyMessage="Inbox порожній. Гарний знак 🌿" />
  );
}
