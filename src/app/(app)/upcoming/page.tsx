import { createClient } from "@/lib/supabase/server";
import { UpcomingView } from "@/components/gentle/upcoming-view";
import type { DbTask } from "@/types/gentle";

export default async function UpcomingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .not("due_date", "is", null)
    .neq("status", "completed")
    .order("due_date", { ascending: true });

  return (
    <UpcomingView initialTasks={(tasks ?? []) as DbTask[]} emptyMessage="Немає запланованих задач 🌿" />
  );
}
