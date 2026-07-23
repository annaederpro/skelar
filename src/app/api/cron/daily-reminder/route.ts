import { createAdminClient } from "@/lib/supabase/admin";
import { createBot } from "@/lib/telegram/bot";
import { pluralizeTasks } from "@/lib/telegram/pluralize";
import { getAppToday } from "@/lib/date";
import { formatDueTime, type DbTask } from "@/types/gentle";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const bot = createBot();
  const today = getAppToday();

  const { data: users } = await admin
    .from("users")
    .select("id, telegram_chat_id")
    .eq("daily_reminder_enabled", true)
    .not("telegram_chat_id", "is", null);

  for (const user of users ?? []) {
    const { data: tasks } = await admin
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("due_date", today)
      .eq("status", "todo")
      .is("released_at", null);

    if (!tasks || tasks.length === 0) continue;

    const typedTasks = tasks as DbTask[];
    const lines = typedTasks.map(
      (t) => `· ${t.title}${t.due_time ? ` о ${formatDueTime(t.due_time)}` : ""}`,
    );
    const header = `🐠 Ще трішки на сьогодні — ${typedTasks.length} ${pluralizeTasks(typedTasks.length)}:`;

    await bot.api.sendMessage(user.telegram_chat_id!, [header, ...lines].join("\n")).catch((err) => {
      console.error("daily reminder send failed for user", user.id, err);
    });
  }

  return new Response("ok");
}
