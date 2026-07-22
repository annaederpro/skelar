import Link from "next/link";
import { Trash2 } from "lucide-react";
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
    .is("released_at", null)
    .order("created_at", { ascending: false });

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
      <TaskView initialTasks={(tasks ?? []) as DbTask[]} emptyMessage="Всі задачі порожні. Гарний знак 🌿" />
    </div>
  );
}
