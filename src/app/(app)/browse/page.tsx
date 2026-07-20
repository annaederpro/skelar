import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateProjectForm } from "@/components/gentle/create-project-form";

export default async function BrowsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, tasks(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <CreateProjectForm />

      <div className="flex flex-col gap-2">
        {(projects ?? []).length === 0 && (
          <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Проєктів поки немає — створи перший вище.
          </p>
        )}
        {(projects ?? []).map((project) => (
          <Link
            key={project.id}
            href={`/browse/${project.id}`}
            className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:bg-muted/40"
          >
            <FolderOpen className="size-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">{project.name}</span>
            <span className="text-xs text-muted-foreground">
              {(project.tasks as { count: number }[])[0]?.count ?? 0}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
