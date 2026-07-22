import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaskView } from "@/components/gentle/task-view";
import type { DbTask } from "@/types/gentle";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project) {
    notFound();
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .is("released_at", null)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">{project.name}</h2>
      <TaskView
        initialTasks={(tasks ?? []) as DbTask[]}
        emptyMessage="У цьому проєкті поки немає задач 🌿"
      />
    </div>
  );
}
