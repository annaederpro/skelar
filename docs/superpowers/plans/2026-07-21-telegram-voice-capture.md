# Telegram Voice Task Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Telegram bot webhook (`/api/telegram/webhook`) that turns forwarded voice or text messages into coralQ tasks: voice is transcribed via Whisper (through OpenRouter — see the Task 3 correction note), everything is parsed by the existing `parseTaskWithOpenRouter`, and the task is inserted for the linked user via the Supabase service-role client.

**Architecture:** One Next.js Route Handler wraps a grammY `Bot` via `webhookCallback(bot, "std/http", { secretToken })`. Fast handlers (`/start`, `/link`, unlinked-chat replies) run inline; the heavy pipeline (download → Whisper → parse → insert → confirm) runs in Next.js `after()` so Telegram gets its ack in milliseconds and grammY's 10s webhook timeout never fires. The parse and insert logic currently inlined in the `parseTaskWithAI`/`addTask` Server Actions is extracted into client-injected helpers shared by both the browser path (cookie client) and the bot path (admin client).

**Tech Stack:** Next.js 16 Route Handlers + `after()`, grammY (new dependency, the only one), raw `fetch`/`FormData` to OpenRouter's `audio/transcriptions` endpoint (`openai/whisper-1`), existing `parseTaskWithOpenRouter` (OpenRouter), Supabase service-role client (`createAdminClient`).

**Spec:** `docs/superpowers/specs/2026-07-21-telegram-voice-capture-design.md`

## Global Constraints

- This repo runs a modified Next.js 16 — check `node_modules/next/dist/docs/` if any API is in doubt; `after()` and Route Handler conventions were already verified there (`after` is stable, Route Handlers use Web `Request`/`Response`).
- All user-facing bot copy is Ukrainian, matching the tone of existing strings in `src/app/actions.ts` (e.g. `"Щось пішло не так, спробуй ще раз."`).
- Env vars `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_LINK_SECRET`, `TELEGRAM_OWNER_EMAIL` are server-only: never `NEXT_PUBLIC_`-prefixed, never read from a `"use client"` file. (No separate OpenAI key — Whisper goes through the existing `OPENROUTER_API_KEY`, see Task 3.)
- `grammy` is the only new npm dependency. Whisper is called with raw `fetch` + `FormData` against OpenRouter's transcription endpoint, mirroring the hand-rolled OpenRouter chat-completions call in `src/lib/ai/parse-task.ts`. Do not install the `openai` package.
- Existing exported signatures of `addTask` and `parseTaskWithAI` in `src/app/actions.ts` must not change (the quick-add form imports them).
- No test runner exists in this repo; each task's gate is `npx tsc --noEmit` + `npm run lint`, and Tasks 6–7 are the manual verification defined by the spec.
- Every commit: `git commit --no-gpg-sign` (pinentry cannot prompt in this environment).
- Code style: 2-space indent, double quotes, `@/` path alias, no semicolon omission — match neighboring files.

---

### Task 1: Install grammy and scaffold env vars

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: nothing.
- Produces: `grammy` importable; documented env var names for Tasks 4–6.

- [ ] **Step 1: Install grammy**

Run: `npm install grammy`
Expected: exit 0, `grammy` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Extend `.env.local.example`**

Replace the existing block

```
# Telegram bot (Block 4)
TELEGRAM_BOT_TOKEN=
```

with:

```
# Telegram bot (Block 4)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_LINK_SECRET=
TELEGRAM_OWNER_EMAIL=
```

All other lines (Supabase, Gemini, OpenRouter) stay untouched. No separate
OpenAI section is needed — Whisper transcription (Task 3) goes through the
existing `OPENROUTER_API_KEY`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass (nothing imports grammy yet; this catches accidental damage only).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit --no-gpg-sign -m "chore: add grammy and Telegram/OpenAI env var scaffolding"
```

---

### Task 2: Extract shared parse/insert helpers out of the Server Actions

**Files:**
- Create: `src/lib/tasks/insert-task.ts`
- Create: `src/lib/ai/parse-task-for-user.ts`
- Modify: `src/app/actions.ts` (bodies of `addTask` and `parseTaskWithAI` only)

**Interfaces:**
- Consumes: `parseTaskWithOpenRouter`, `ParseTaskResult` from `src/lib/ai/parse-task.ts`; `getAppToday` from `src/lib/date.ts`; types from `src/types/gentle.ts`.
- Produces (Tasks 4 relies on these exact signatures):
  - `insertTaskForUser(supabase: SupabaseClient, userId: string, input: InsertTaskInput): Promise<{ task: DbTask } | { error: string }>`
  - `parseTaskForUser(supabase: SupabaseClient, userId: string, rawText: string): Promise<ParseTaskResult>`

Behavior note: the extracted `parseTaskForUser` uses `getAppToday()` (Europe/Kyiv) for `todayIso` where `parseTaskWithAI` previously used UTC `new Date().toISOString().slice(0, 10)`. This is a deliberate tiny improvement — the Kyiv helper already exists and makes "завтра" resolve correctly late in the evening; it changes behavior only in the hours where UTC and Kyiv dates disagree. Everything else is a same-behavior extraction.

- [ ] **Step 1: Create `src/lib/tasks/insert-task.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbTask, EnergyLevel, Priority } from "@/types/gentle";

export type InsertTaskInput = {
  title: string;
  energyLevel: EnergyLevel;
  durationMinutes: number;
  projectId?: string | null;
  priority?: Priority;
  dueDate?: string | null;
  dueTime?: string | null;
};

/**
 * Core task insert shared by the browser path (cookie-authenticated client)
 * and the Telegram bot (service-role admin client). The caller is responsible
 * for having resolved a trustworthy userId for the given client.
 */
export async function insertTaskForUser(
  supabase: SupabaseClient,
  userId: string,
  input: InsertTaskInput,
): Promise<{ task: DbTask } | { error: string }> {
  if (input.projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.projectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!project) {
      return { error: "Проєкт не знайдено." };
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title,
      energy_level: input.energyLevel,
      duration_minutes: input.durationMinutes,
      project_id: input.projectId ?? null,
      priority: input.priority ?? 4,
      due_date: input.dueDate ?? null,
      due_time: input.dueDate ? (input.dueTime ?? null) : null,
    })
    .select()
    .single();

  if (error || !data) {
    return { error: "Не вдалося додати задачу, спробуй ще раз." };
  }

  return { task: data as DbTask };
}
```

- [ ] **Step 2: Create `src/lib/ai/parse-task-for-user.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTaskWithOpenRouter, type ParseTaskResult } from "@/lib/ai/parse-task";
import { getAppToday } from "@/lib/date";

/**
 * Fetches the user's projects and runs the OpenRouter parser. Shared by the
 * browser Server Action and the Telegram bot; the Supabase client decides
 * whose credentials apply (cookie session vs service role).
 */
export async function parseTaskForUser(
  supabase: SupabaseClient,
  userId: string,
  rawText: string,
): Promise<ParseTaskResult> {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", userId);

  return parseTaskWithOpenRouter(rawText, projects ?? [], getAppToday());
}
```

- [ ] **Step 3: Rewire `src/app/actions.ts`**

Add imports at the top (alongside the existing ones):

```ts
import { parseTaskForUser } from "@/lib/ai/parse-task-for-user";
import { insertTaskForUser } from "@/lib/tasks/insert-task";
```

Replace the body of `addTask` after the `if (!user)` guard — delete the project-ownership check and the `.from("tasks").insert(...)` block (everything from `if (input.projectId) {` through `return { task: data as DbTask };`) and replace with:

```ts
  return insertTaskForUser(supabase, user.id, input);
```

Replace the body of `parseTaskWithAI` after the `if (!user)` guard — delete the projects fetch and `todayIso`/`parseTaskWithOpenRouter` lines and replace with:

```ts
  return parseTaskForUser(supabase, user.id, rawText);
```

The `parseTaskWithOpenRouter` import in `actions.ts` becomes unused — remove it from the import list but keep `type ParseTaskResult` (still referenced by `parseTaskWithAI`'s return type):

```ts
import type { ParseTaskResult } from "@/lib/ai/parse-task";
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass. If tsc complains about `SupabaseClient` generics mismatch between `@supabase/ssr`'s client and the helper parameter, widen the parameter type — it must accept both `createClient()` (browser path) and `createAdminClient()` (bot path) results.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tasks/insert-task.ts src/lib/ai/parse-task-for-user.ts src/app/actions.ts
git commit --no-gpg-sign -m "refactor: extract client-injected parse/insert helpers for reuse by the Telegram bot"
```

---

### Task 3: Whisper transcription helper

**Files:**
- Create: `src/lib/telegram/transcribe.ts`

**Interfaces:**
- Consumes: `OPENROUTER_API_KEY` env var (see correction below); a fully-qualified Telegram file URL.
- Produces (Task 4 relies on this): `transcribeVoice(fileUrl: string): Promise<string | null>` — transcript text, or `null` on any failure (missing key, download error, API error, empty transcript).

> **Correction (post Task 7 real-device test):** the plan originally called
> direct OpenAI (`OPENAI_API_KEY`, `api.openai.com`). Real voice notes
> consistently failed. Root-cause testing — calling the transcription
> endpoint directly with the exact `.env.local` key, using a throwaway
> garbage audio file to isolate auth from audio validity — showed OpenAI
> returned `429 insufficient_quota` (key valid, no billing/credits on that
> account). The same test against OpenRouter's
> `/api/v1/audio/transcriptions` with the existing, already-funded
> `OPENROUTER_API_KEY` returned `400` for the same garbage file (auth and
> quota both fine, only the fake audio was rejected) — confirming the fix
> below before writing it. `OPENAI_API_KEY` is no longer used anywhere and
> was removed from `.env.local.example`.

- [ ] **Step 1: Create `src/lib/telegram/transcribe.ts`**

```ts
/**
 * Downloads a Telegram voice file and transcribes it with Whisper via
 * OpenRouter's OpenAI-compatible transcription endpoint (reuses the same
 * OPENROUTER_API_KEY / account already used for task parsing, rather than a
 * separate OpenAI account). Telegram voice notes are OGG/Opus; `ogg` is an
 * accepted Whisper input format, so the file is forwarded as-is under the
 * name "voice.ogg" — no audio conversion. Server-only.
 */
export async function transcribeVoice(fileUrl: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("transcribeVoice: OPENROUTER_API_KEY is not set");
    return null;
  }

  try {
    const audioResponse = await fetch(fileUrl);
    if (!audioResponse.ok) {
      console.error("transcribeVoice: failed to download voice file", audioResponse.status);
      return null;
    }
    const audioBlob = await audioResponse.blob();

    const form = new FormData();
    form.append("file", new File([audioBlob], "voice.ogg", { type: "audio/ogg" }));
    form.append("model", "openai/whisper-1");

    const response = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      console.error("transcribeVoice: OpenRouter returned", response.status, await response.text());
      return null;
    }

    const body = await response.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    return text || null;
  } catch (err) {
    console.error("transcribeVoice: unexpected error", err);
    return null;
  }
}
```

(Do not set a `Content-Type` header manually — `fetch` derives the correct `multipart/form-data` boundary from the `FormData` body.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass. (Real transcription is exercised in Task 7 — there is no way to meaningfully test this without a live key and audio.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram/transcribe.ts
git commit --no-gpg-sign -m "feat: add Whisper transcription helper for Telegram voice files"
```

---

### Task 4: The grammY bot with all handlers

**Files:**
- Create: `src/lib/telegram/bot.ts`

**Interfaces:**
- Consumes: `insertTaskForUser`/`InsertTaskInput` (Task 2), `parseTaskForUser` (Task 2), `transcribeVoice` (Task 3), `createAdminClient` from `src/lib/supabase/admin.ts`, `getAppToday` from `src/lib/date.ts`, `DbTask`/`EFFORT_WORD`/`formatDuration`/`priorityBucket` from `src/types/gentle.ts`, `after` from `next/server`.
- Produces (Task 5 relies on this): `createBot(): Bot` — a fully wired grammY `Bot`; throws if `TELEGRAM_BOT_TOKEN` is unset.

Design notes the implementer must not "fix":
- Handler order matters: `bot.command(...)` registrations come before `bot.on("message:voice")`/`bot.on("message:text")`, so commands never fall through into task parsing. Unknown `/commands` are filtered in the text handler.
- The `after()` callback gets its own `try`/`catch`. `bot.catch()` is a no-op in webhook mode — grammY's `webhookCallback` calls `handleUpdate()` (singular) directly, and only the long-polling `handleUpdates()` path ever dispatches to a registered error handler (confirmed by reading `node_modules/grammy/out/bot.js` during Task 6 verification, after a synthetic test produced an unhandled 500). Don't register `bot.catch()` here — it would be dead code. The real backstop for synchronous handler errors is the `try`/`catch` in `route.ts` (Task 5); the deferred `after()` pipeline needs its own catch regardless, since that code runs after the route handler has already returned.
- Replies inside `after()` use `ctx.api.sendMessage(chatId, ...)` with the saved numeric `chatId`, not `ctx.reply(...)` — plain data captured before deferring, per the spec's "capture what's needed into plain variables" rule.
- `telegram_chat_id` is a `text` column; always compare/store `String(chat.id)`.

- [ ] **Step 1: Create `src/lib/telegram/bot.ts`**

```ts
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
    // chain runs after the webhook response is sent.
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

  // bot.catch() is intentionally not used here — grammY only routes through
  // it from the long-polling handleUpdates() path. In webhook mode,
  // webhookCallback calls handleUpdate() directly, whose errors propagate to
  // the caller uncaught. route.ts (Task 5) is what actually guards against a
  // thrown error here becoming an unhandled 500.

  return bot;
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass. Known sharp edges if they don't:
- `ctx.match` on commands is `string | RegExpMatchArray` in grammY — the `typeof ctx.match === "string"` guard above handles it.
- Under the `message:voice` / `message:text` filters, `ctx.message` and `ctx.chat` are non-nullable; if tsc disagrees, the filter string is misspelled.

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram/bot.ts
git commit --no-gpg-sign -m "feat: grammY bot with /link and voice/text task capture handlers"
```

---

### Task 5: The webhook Route Handler

**Files:**
- Create: `src/app/api/telegram/webhook/route.ts`

**Interfaces:**
- Consumes: `createBot` (Task 4), `webhookCallback` from grammy, `TELEGRAM_WEBHOOK_SECRET` env var.
- Produces: `POST /api/telegram/webhook` — the URL registered with Telegram's `setWebhook` in Task 7.

- [ ] **Step 1: Create `src/app/api/telegram/webhook/route.ts`**

```ts
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
```

- [ ] **Step 2: Verify types, lint, and production build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three pass. The build must succeed **without** `TELEGRAM_BOT_TOKEN` set — if it fails on the missing token, the lazy-init in Step 1 got broken (the bot must not be constructed at module scope).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/telegram/webhook/route.ts
git commit --no-gpg-sign -m "feat: Telegram webhook route handler with secret-token verification"
```

---

### Task 6: Local synthetic verification (spec Testing §1, §3, §4)

**Files:**
- Modify: `.env.local` (add the five new vars — never committed; it is gitignored)

**Interfaces:**
- Consumes: the running dev server, `.env.local` Supabase values, real `TELEGRAM_BOT_TOKEN` + `OPENROUTER_API_KEY`.
- Produces: verified end-to-end text pipeline (webhook → parse → insert → sendMessage attempt) and verified link/unlinked guards.

**This task needs the user.** One value cannot be self-provisioned:
- `TELEGRAM_BOT_TOKEN` — user creates the bot via @BotFather (`/newbot`) and pastes the token.

(No separate OpenAI key needed for the voice leg — Whisper transcription
goes through the existing `OPENROUTER_API_KEY`, already present in
`.env.local` for text parsing.)

A real (BotFather-issued) token is required even for synthetic local tests: grammY calls `getMe` on the first processed update, and a made-up token fails that call with 401. `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_LINK_SECRET` are generated locally; `TELEGRAM_OWNER_EMAIL` must be the email of the user's actual coralQ account row in `public.users` (confirm with the user — likely `rene.eder@redfox.management`).

- [ ] **Step 1: Fill `.env.local`**

Generate secrets and append (with the user-provided token):

```bash
echo "TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 16)"
echo "TELEGRAM_LINK_SECRET=$(openssl rand -hex 8)"
```

Add to `.env.local`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_LINK_SECRET`, `TELEGRAM_OWNER_EMAIL`.

- [ ] **Step 2: Start the dev server**

Use the existing launch config / `preview_start` (the repo already auto-picks a port if 3000 is busy — note the actual port and substitute below).

- [ ] **Step 3: Unlinked-chat guard (spec Testing §4)**

Send a text-task update from a chat that has never linked (id `999000111`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:3000/api/telegram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET value>" \
  -d '{"update_id":900001,"message":{"message_id":1,"date":1753100000,"chat":{"id":999000111,"type":"private","first_name":"Test"},"from":{"id":999000111,"is_bot":false,"first_name":"Test"},"text":"Завтра купити молоко"}}'
```

Expected: `200`. Dev-server log shows a failed `sendMessage` to chat 999000111 ("chat not found" — the chat is fake, which is precisely the evidence the not-linked reply was *attempted*). Confirm **no task row** was created:

```bash
export $(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=' .env.local | xargs)
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/tasks?select=title,created_at&order=created_at.desc&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: newest task is a pre-existing one, not "купити молоко".

Also send one request with a **wrong** `X-Telegram-Bot-Api-Secret-Token` header:
Expected: non-200 (grammY rejects it with 401 "secret token is wrong") and nothing in the logs.

- [ ] **Step 4: `/link` with wrong then right secret (spec Testing §3)**

Wrong secret (note the `entities` array — grammY only recognizes commands Telegram has marked as `bot_command`):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:3000/api/telegram/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET value>" \
  -d '{"update_id":900002,"message":{"message_id":2,"date":1753100010,"chat":{"id":999000111,"type":"private","first_name":"Test"},"from":{"id":999000111,"is_bot":false,"first_name":"Test"},"text":"/link wrongcode","entities":[{"type":"bot_command","offset":0,"length":5}]}}'
```

Then verify `telegram_chat_id` is still unset:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/users?select=email,telegram_chat_id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: the owner row has `"telegram_chat_id": null`.

Repeat with the real `TELEGRAM_LINK_SECRET` in place of `wrongcode` (bump `update_id` to 900003), re-run the users query.
Expected: owner row now has `"telegram_chat_id": "999000111"`.

- [ ] **Step 5: Full text pipeline (spec Testing §1)**

Re-send the Step 3 task update with `update_id` 900004 (chat 999000111 is now linked). Expected: `200` immediately; within a few seconds the dev log shows the OpenRouter call completing and a failed `sendMessage` confirmation attempt (fake chat). Then:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/tasks?select=title,due_date,priority,energy_level,duration_minutes&order=created_at.desc&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: a task titled ~"Купити молоко" with `due_date` = tomorrow (Kyiv). This proves webhook → grammY → `after()` → parse → insert end-to-end.

- [ ] **Step 6: Clean up synthetic data**

```bash
curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/tasks?title=eq.<exact title from Step 5>" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Leave `telegram_chat_id = "999000111"` — Task 7's real `/link` from the phone overwrites it.

- [ ] **Step 7: Commit** — nothing to commit (`.env.local` is gitignored). Record results in the session notes instead.

---

### Task 7: Register the webhook and real-device voice test (spec Testing §2)

**Files:** none (operational task).

**Interfaces:**
- Consumes: everything shipped in Tasks 1–6; a public HTTPS URL for the dev server (tunnel) or a deployment.
- Produces: the feature verified the way it will actually be used — a voice note forwarded from a phone becomes a coralQ task.

**This task needs the user** (their phone and their Telegram account — the Whisper leg uses the already-present `OPENROUTER_API_KEY`, no separate key needed).

- [ ] **Step 1: Expose the local server over HTTPS**

If the app is not deployed anywhere yet, use a quick tunnel (no account needed):

```bash
cloudflared tunnel --url http://localhost:3000
```

(`brew install cloudflared` if missing.) Note the `https://<random>.trycloudflare.com` URL. If the app *is* deployed, use the deployment URL instead and make sure all five env vars are set there.

- [ ] **Step 2: Register the webhook with Telegram**

```bash
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  --data-urlencode "url=https://<public-host>/api/telegram/webhook" \
  --data-urlencode "secret_token=<TELEGRAM_WEBHOOK_SECRET value>"
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`. Sanity-check with `getWebhookInfo`:

```bash
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Expected: `url` matches, `last_error_message` absent.

- [ ] **Step 3: Real `/start` + `/link` from the phone**

User opens the bot in Telegram, sends `/start` (expects the greeting), then `/link <TELEGRAM_LINK_SECRET value>` (expects "✅ Прив'язано!"). Verify via the users REST query from Task 6 Step 4 that `telegram_chat_id` now holds their real chat id (no longer `999000111`).

- [ ] **Step 4: The actual voice test**

User records/forwards a voice note in Ukrainian, e.g. *"Завтра о третій подзвонити клієнту, це важливо, хвилин на двадцять"*. Expected, within a few seconds: a `✅ Додано: «…»` reply summarizing title / «завтра» / duration / «важливо», and the task visible in the coralQ UI with matching fields. Also send one **plain text** task message and confirm the same.

- [ ] **Step 5: Failure-path spot check**

User sends a voice note of silence/noise. Expected: `"Не вдалося розпізнати голосове, спробуй ще раз."` or the parse-failure message — any graceful reply, no silent drop, no crash in the server log.

- [ ] **Step 6: Wrap up**

If the tunnel was temporary, either leave the webhook registered (it fails harmlessly with retries while the tunnel is down, and Telegram queues updates for ~24h) or clear it:

```bash
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook"
```

Note in the project memory that the device test passed (this closes the "voice untested on device" gap for the Telegram path specifically).
