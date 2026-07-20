import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/gentle/app-shell";
import type { DbProject, ResourceStatus } from "@/types/gentle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware (src/middleware.ts) redirects unauthenticated requests to
  // /login before this layout ever renders, so `user` is always present here.
  const userId = user!.id;

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: profile }, { data: projects }, { count: todayCount }] = await Promise.all([
    supabase.from("users").select("current_resource_status").eq("id", userId).single(),
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("due_date", today)
      .neq("status", "completed"),
  ]);

  return (
    <AppShell
      initialResourceStatus={(profile?.current_resource_status ?? "normal") as ResourceStatus}
      projects={(projects ?? []) as DbProject[]}
      todayCount={todayCount ?? 0}
    >
      {children}
    </AppShell>
  );
}
