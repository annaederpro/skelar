import { Bot, type Context } from "grammy";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTaskForUser } from "@/lib/ai/parse-task-for-user";
import { insertTaskForUser } from "@/lib/tasks/insert-task";
import { transcribeVoice } from "@/lib/telegram/transcribe";
import { getAppToday } from "@/lib/date";
import {
  EFFORT_WORD,
  formatDuration,
  formatDueTime,
  priorityBucket,
  type DbTask,
} from "@/types/gentle";

// Whisper caps uploads at 25MB; refuse slightly below that.
const MAX_VOICE_BYTES = 24 * 1024 * 1024;

const MSG_NOT_LINKED = "Спочатку напиши /link <код>.";
const MSG_VOICE_FAILED = "Не вдалося розпізнати голосове, спробуй ще раз.";
const MSG_PARSE_FAILED = "Не вдалося розібрати задачу з цього тексту.";
const MSG_GENERIC_FAILED = "Щось пішло не так, спробуй ще раз.";

async function lookupLinkedUserId(
  admin: SupabaseClient,
  chatId: number,
): Promise<string | null> {
  const { data } = await admin
    .from("users")
    .select("id")
    .eq("telegram_chat_id", String(chatId))
    .maybeSingle();
  return data?.id ?? null;
}

// Shared by /link and /start's deep-link payload: looks up a user by an
// unexpired one-time code, links this chat to them, and clears the code
// so it can't be replayed.
async function tryLinkChat(
  admin: SupabaseClient,
  chatId: number,
  code: string,
): Promise<boolean> {
  const { data } = await admin
    .from("users")
    .select("id")
    .eq("telegram_link_code", code)
    .gt("telegram_link_code_expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return false;

  // A chat can only ever be linked to one account. Clear it from whichever
  // account currently holds it (if any) before attaching it to the new one,
  // so lookupLinkedUserId's .maybeSingle() never sees two matching rows.
  await admin
    .from("users")
    .update({ telegram_chat_id: null })
    .eq("telegram_chat_id", String(chatId))
    .neq("id", data.id);

  const { error } = await admin
    .from("users")
    .update({
      telegram_chat_id: String(chatId),
      telegram_link_code: null,
      telegram_link_code_expires_at: null,
    })
    .eq("id", data.id);

  return !error;
}

function nextDayIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function describeTask(task: DbTask): string {
  const today = getAppToday();
  const parts = [`«${task.title}»`];
  if (task.due_date) {
    if (task.due_date === today) {
      parts.push("сьогодні");
    } else if (task.due_date === nextDayIso(today)) {
      parts.push("завтра");
    } else {
      const [, month, day] = task.due_date.split("-");
      parts.push(`${day}.${month}`);
    }
    if (task.due_time) {
      parts.push(formatDueTime(task.due_time));
    }
  }
  parts.push(formatDuration(task.duration_minutes));
  parts.push(EFFORT_WORD[task.energy_level]);
  if (priorityBucket(task.priority) === "high") {
    parts.push("важливо");
  }
  return parts.join(" · ");
}

// Runs inside after(): parse raw text into tasks, insert each, send one
// confirmation per task (so a later reply/👍 on that exact message can be
// traced back to exactly one task — see tryCompleteFromMessage below).
async function createTaskFromText(
  ctx: Context,
  admin: SupabaseClient,
  userId: string,
  chatId: number,
  rawText: string,
): Promise<void> {
  const parsed = await parseTaskForUser(admin, userId, rawText);
  if (!parsed.ok) {
    await ctx.api.sendMessage(chatId, MSG_PARSE_FAILED);
    return;
  }

  const insertedTasks: DbTask[] = [];
  for (const task of parsed.tasks) {
    const result = await insertTaskForUser(admin, userId, {
      title: task.title,
      energyLevel: task.energyLevel ?? 1,
      durationMinutes: task.durationMinutes ?? 30,
      projectId: task.projectId,
      priority: task.priority ?? 4,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      source: "telegram",
    });
    if ("task" in result) {
      insertedTasks.push(result.task);
    }
  }

  if (insertedTasks.length === 0) {
    await ctx.api.sendMessage(chatId, MSG_GENERIC_FAILED);
    return;
  }

  for (const task of insertedTasks) {
    const sent = await ctx.api.sendMessage(chatId, `✅ Додано: ${describeTask(task)}`);
    await admin
      .from("tasks")
      .update({ telegram_confirmation_message_id: sent.message_id })
      .eq("id", task.id);
  }

  const notSaved = parsed.tasks.length - insertedTasks.length;
  if (notSaved > 0) {
    await ctx.api.sendMessage(chatId, `⚠️ ${notSaved} не вдалося зберегти, спробуй ще раз.`);
  }
}

export function createBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";

    if (payload) {
      const linked = await tryLinkChat(createAdminClient(), ctx.chat.id, payload);
      await ctx.reply(
        linked
          ? "✅ Прив'язано! Тепер надсилай голосові або текстові задачі."
          : "Код недійсний або застарів. Згенеруй новий код у coralQ.",
      );
      return;
    }

    await ctx.reply(
      "Привіт! Я додаю задачі в coralQ 🐠\n" +
        "Надішли мені текст або голосове — розберу і збережу.\n" +
        "Відкрий Налаштування → Під'єднати Telegram у coralQ, щоб прив'язати акаунт.",
    );
  });

  bot.command("link", async (ctx) => {
    const code = typeof ctx.match === "string" ? ctx.match.trim() : "";
    if (!code) {
      await ctx.reply("Код недійсний або застарів. Згенеруй новий код у coralQ.");
      return;
    }

    const linked = await tryLinkChat(createAdminClient(), ctx.chat.id, code);
    await ctx.reply(
      linked
        ? "✅ Прив'язано! Тепер надсилай голосові або текстові задачі."
        : "Код недійсний або застарів. Згенеруй новий код у coralQ.",
    );
  });

  bot.on("message:voice", async (ctx) => {
    const admin = createAdminClient();
    const chatId = ctx.chat.id;
    const userId = await lookupLinkedUserId(admin, chatId);
    if (!userId) {
      await ctx.reply(MSG_NOT_LINKED);
      return;
    }

    const voice = ctx.message.voice;
    if (voice.file_size && voice.file_size > MAX_VOICE_BYTES) {
      await ctx.reply("Це голосове занадто велике.");
      return;
    }
    const fileId = voice.file_id;

    // Ack Telegram now; the download → Whisper → parse → insert → confirm
    // chain runs after the webhook response is sent. bot.catch() cannot see
    // errors thrown here, so this callback handles its own failures.
    after(async () => {
      try {
        const file = await ctx.api.getFile(fileId);
        if (!file.file_path) {
          await ctx.api.sendMessage(chatId, MSG_VOICE_FAILED);
          return;
        }
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        const text = await transcribeVoice(fileUrl);
        if (!text) {
          await ctx.api.sendMessage(chatId, MSG_VOICE_FAILED);
          return;
        }
        await createTaskFromText(ctx, admin, userId, chatId, text);
      } catch (err) {
        console.error("telegram voice pipeline failed", err);
        await ctx.api.sendMessage(chatId, MSG_GENERIC_FAILED).catch(() => {});
      }
    });
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) {
      await ctx.reply("Невідома команда. Надішли текст або голосове із задачею.");
      return;
    }

    const admin = createAdminClient();
    const chatId = ctx.chat.id;
    const userId = await lookupLinkedUserId(admin, chatId);
    if (!userId) {
      await ctx.reply(MSG_NOT_LINKED);
      return;
    }

    after(async () => {
      try {
        await createTaskFromText(ctx, admin, userId, chatId, text);
      } catch (err) {
        console.error("telegram text pipeline failed", err);
        await ctx.api.sendMessage(chatId, MSG_GENERIC_FAILED).catch(() => {});
      }
    });
  });

  // Note: bot.catch() is intentionally not used here — grammY only routes
  // through it from the long-polling handleUpdates() path. In webhook mode,
  // webhookCallback calls handleUpdate() directly, whose errors propagate to
  // the caller uncaught. The route handler (route.ts) is what actually
  // guards against a thrown error here becoming an unhandled 500.

  return bot;
}
