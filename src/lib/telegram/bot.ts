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

function nextDayIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildConfirmation(task: DbTask): string {
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
  return `✅ Додано: ${parts.join(" · ")}`;
}

// Runs inside after(): parse raw text into a task, insert it, confirm in chat.
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

  const result = await insertTaskForUser(admin, userId, {
    title: parsed.title,
    energyLevel: parsed.energyLevel ?? 1,
    durationMinutes: parsed.durationMinutes ?? 30,
    projectId: parsed.projectId,
    priority: parsed.priority ?? 4,
    dueDate: parsed.dueDate,
    dueTime: parsed.dueTime,
  });
  if ("error" in result) {
    await ctx.api.sendMessage(chatId, MSG_GENERIC_FAILED);
    return;
  }

  await ctx.api.sendMessage(chatId, buildConfirmation(result.task));
}

export function createBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  const bot = new Bot(token);

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Привіт! Я додаю задачі в coralQ 🐠\n" +
        "Надішли мені текст або голосове — розберу і збережу.\n" +
        "Спочатку прив'яжи акаунт: /link <код>",
    );
  });

  bot.command("link", async (ctx) => {
    const secret = process.env.TELEGRAM_LINK_SECRET;
    const ownerEmail = process.env.TELEGRAM_OWNER_EMAIL;
    const supplied = typeof ctx.match === "string" ? ctx.match.trim() : "";

    if (!secret || !ownerEmail || !supplied || supplied !== secret) {
      await ctx.reply("❌ Невірний код.");
      return;
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("users")
      .update({ telegram_chat_id: String(ctx.chat.id) })
      .eq("email", ownerEmail)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      await ctx.reply(MSG_GENERIC_FAILED);
      return;
    }

    await ctx.reply("✅ Прив'язано! Тепер надсилай голосові або текстові задачі.");
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
