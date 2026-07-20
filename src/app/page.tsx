import { createClient } from "@/lib/supabase/server";
import { TaskDashboard } from "@/components/gentle/task-dashboard";
import type { DbTask, ResourceStatus } from "@/types/gentle";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware (src/middleware.ts) redirects unauthenticated requests to
  // /login before this component ever renders, so `user` is always present here.
  const userId = user!.id;

  const [{ data: tasks }, { data: profile }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("users").select("current_resource_status").eq("id", userId).single(),
  ]);

  return (
    <TaskDashboard
      initialTasks={(tasks ?? []) as DbTask[]}
      initialResourceStatus={(profile?.current_resource_status ?? "normal") as ResourceStatus}
    />
  );
}
