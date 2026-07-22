import { webhookCallback } from "grammy";
import { createBot } from "@/lib/telegram/bot";

export const runtime = "nodejs";
// Give the after() pipeline (download + Whisper + OpenRouter + insert)
// room on serverless platforms; irrelevant when self-hosted.
export const maxDuration = 60;

// Built lazily so `next build` never needs Telegram env vars, and reused
// across warm invocations.
let handleUpdate: ((req: Request) => Promise<Response>) | null = null;

export async function POST(req: Request): Promise<Response> {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secretToken) {
    // Refuse to run unauthenticated rather than silently accepting any POST.
    return new Response("TELEGRAM_WEBHOOK_SECRET is not configured", { status: 500 });
  }

  handleUpdate ??= webhookCallback(createBot(), "std/http", { secretToken });
  try {
    return await handleUpdate(req);
  } catch (err) {
    // grammY's bot.catch() does not apply in webhook mode (it only fires
    // from the long-polling path) — this is the actual backstop. Always ack
    // Telegram so a downstream failure (e.g. a reply that couldn't be sent)
    // doesn't turn into repeated webhook redeliveries.
    console.error("telegram webhook handleUpdate failed", err);
    return new Response(null, { status: 200 });
  }
}
