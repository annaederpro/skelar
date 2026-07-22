import { createClient } from "@/lib/supabase/server";
import { TrashView } from "@/components/gentle/trash-view";
import type { DbTask } from "@/types/gentle";

export default async function TrashPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .not("released_at", "is", null)
    .order("released_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-xl font-semibold">Кошик</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Задачі, які ти відпустив — вони чекають тут, якщо захочеш повернутись.
        </p>
      </div>
      <TrashView initialTasks={(tasks ?? []) as DbTask[]} />
    </div>
  );
}
