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
  return handleUpdate(req);
}
