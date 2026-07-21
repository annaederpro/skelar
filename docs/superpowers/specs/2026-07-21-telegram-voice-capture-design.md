# Telegram voice task capture — design spec

## Context

coralQ already has two ways to create a task: the manual form, and
in-browser AI capture (`docs/superpowers/specs/2026-07-21-ai-task-capture-design.md`)
where typed or `SpeechRecognition`-transcribed text is parsed by
`parseTaskWithOpenRouter` and used to pre-fill the manual form. Both of
those require an authenticated browser session — there is no way to add a
task without opening the app.

The schema already anticipated a Telegram integration: `public.users` has
had a `telegram_chat_id` column since the very first migration, and that
migration's own comment says *"Service role (used by the Telegram bot /
server routes with the service key) bypasses RLS automatically."*
`.env.local.example` has an empty `TELEGRAM_BOT_TOKEN` placeholder labeled
`# Telegram bot (Block 4)`. Nothing has used any of this yet. This spec is
that block.

This is also the first `app/api/**/route.ts` in the codebase (everything
else is Server Actions/Server Components) and the first server-side
transcription path (existing voice capture is browser-only, explicitly
punting "audio upload / server-side transcription" to later — see that
spec's Non-goals). It's a second, parallel entry point into the same
`tasks` table: browser → cookie-authenticated Server Actions on one side,
Telegram → service-role admin client on the other, both converging on the
same parsing and insert logic.

## Decisions locked with the user before writing this spec

- **Account linking**: `/link <secret>` bot command. `TELEGRAM_LINK_SECRET`
  env var is the code; on a match, the admin client sets
  `telegram_chat_id = ctx.chat.id` on the `public.users` row matching
  `TELEGRAM_OWNER_EMAIL`. Every other handler resolves the acting user by
  looking up `telegram_chat_id = ctx.chat.id`.
- **Insert UX**: the task is inserted immediately; the bot then replies
  with a confirmation summarizing what was created. No preview-then-confirm
  step, no undo button — matches the request as stated and keeps the bot
  stateless (no pending-task storage between messages).
- **Scope**: both voice and plain text messages go through the same
  parser. Voice is transcribed first; text skips straight to parsing. Only
  Telegram's `voice` message type is handled (not `audio`, `document`, or
  `video_note`).
- **Timeout handling**: the webhook acks Telegram as soon as it has
  extracted what it needs from the incoming message (chat id, file id or
  text). The actual pipeline — download, transcribe, parse, insert, reply —
  runs inside Next.js's `after()`, scheduled after that ack, not awaited
  before it. grammY's `webhookCallback` defaults to a 10s timeout; this
  sidesteps that limit at the source (the middleware chain itself finishes
  in milliseconds) rather than widening it, and reduces — though does not
  formally eliminate — the chance of Telegram re-delivering an update
  before it sees a fast ack.

## Non-goals (this pass)

- `audio` / `document` / `video_note` Telegram message types. Trivial to
  add later (`transcribeVoice` only needs a file URL) but not built now.
- Multi-user linking. `/link` always targets the single
  `TELEGRAM_OWNER_EMAIL` row. The lookup path (`telegram_chat_id` on
  `users`) isn't hardcoded to one user, so supporting more linked accounts
  later doesn't require re-architecting this — it's just not exposed now.
- Preview-before-insert, undo, or edit-via-Telegram flows.
- Deduplication by Telegram's `update_id` against a redelivered update
  being processed twice.
- Multiple tasks parsed from one message — same non-goal as the existing
  AI-capture spec; `parseTaskWithOpenRouter`'s schema only ever returns one
  task.
- Any change to the manual form or the existing in-browser AI capture flow.

## Architecture and data flow

```
Telegram ──POST──▶ /api/telegram/webhook (route.ts)
                         │
                         ▼
                 grammY Bot middleware
                 (secretToken verified by webhookCallback,
                  routes by message type)
                         │
              ┌──────────┴───────────────┐
              ▼                          ▼
        /start, /link               message:voice / message:text
        (handled inline,             (capture file_id or text + chat.id,
         replies immediately,         schedule after(), return — ack sent)
         no after() needed)                    │
                                     after() callback runs:
                                     ┌────────────────────────────┐
                                     │ 1. resolve user_id by       │
                                     │    telegram_chat_id         │
                                     │    (admin client)           │
                                     │ 2. if voice: ctx.api.getFile│
                                     │    → download .ogg →        │
                                     │    transcribeVoice()        │
                                     │    (OpenAI Whisper)          │
                                     │ 3. parseTaskForUser()        │
                                     │    (existing                │
                                     │    parseTaskWithOpenRouter)  │
                                     │ 4. insertTaskForUser()       │
                                     │    (admin client)            │
                                     │ 5. bot.api.sendMessage       │
                                     │    confirmation               │
                                     └────────────────────────────┘
```

Both the browser path and the Telegram path share the same two pieces of
core logic (parse, insert) via injected Supabase clients — see "Shared
logic extraction" below — rather than duplicating them.

## New files

| File | Responsibility |
|---|---|
| `src/app/api/telegram/webhook/route.ts` | Route Handler. `export const runtime = "nodejs"`. Builds the `Bot` (from `src/lib/telegram/bot.ts`) and returns `webhookCallback(bot, "std/http", { secretToken: process.env.TELEGRAM_WEBHOOK_SECRET })` as `POST`. |
| `src/lib/telegram/bot.ts` | Constructs the grammY `Bot` from `TELEGRAM_BOT_TOKEN`, registers `/start`, `/link`, `message:voice`, `message:text` handlers and `bot.catch()`. |
| `src/lib/telegram/transcribe.ts` | `transcribeVoice(fileUrl: string): Promise<string \| null>` — downloads the Telegram file, POSTs it to OpenAI's audio transcription endpoint as `voice.ogg` via `fetch`/`FormData`, returns the transcript or `null` on failure. |
| `src/lib/ai/parse-task-for-user.ts` | `parseTaskForUser(supabase: SupabaseClient, userId: string, rawText: string): Promise<ParseTaskResult>` — extracted from the body of `parseTaskWithAI` (fetch the user's projects, build `todayIso`, call `parseTaskWithOpenRouter`). |
| `src/lib/tasks/insert-task.ts` | `insertTaskForUser(supabase: SupabaseClient, userId: string, input): Promise<{ task: DbTask } \| { error: string }>` — extracted from the body of `addTask` (project-ownership check + insert with the same field defaults). |

`src/app/actions.ts`: `parseTaskWithAI` and `addTask` become thin wrappers —
resolve the cookie-authenticated user, then call `parseTaskForUser` /
`insertTaskForUser`. Their exported signatures and behavior are unchanged;
this is a pure internal extraction so the webhook can reuse the same logic
with the admin client instead of duplicating it.

## Bot behavior

**`/start`** — replies with a short Ukrainian greeting: what the bot does,
and that `/link <secret>` is needed before it'll do anything else.

**`/link <secret>`** (handled inline, not deferred to `after()` — it's a
single fast write):
- Text after the command doesn't match `TELEGRAM_LINK_SECRET` →
  `"❌ Невірний код."`
- Matches → admin client updates `public.users` set
  `telegram_chat_id = ctx.chat.id` where `email = TELEGRAM_OWNER_EMAIL` →
  `"✅ Прив'язано! Тепер надсилай голосові або текстові задачі."`

**`message:voice`** and **`message:text`** share one code path once there's
raw text in hand:
1. Look up `users` by `telegram_chat_id = ctx.chat.id` (admin client). Not
   found → reply `"Спочатку напиши /link <код>."`, stop — handled inline,
   nothing to defer.
2. Found → pull what's needed into plain variables (`file_id` or message
   text, `chat.id`, resolved `userId`), call `after(async () => { ... })`,
   return immediately (ack sent). Inside `after()`:
   - *(voice only)* guard on `voice.file_size` (~24MB max, under Whisper's
     25MB cap) → `ctx.api.getFile(file_id)` → build the
     `https://api.telegram.org/file/bot<token>/<file_path>` URL →
     `transcribeVoice()`. Empty/failed transcription → send
     `"Не вдалося розпізнати голосове, спробуй ще раз."`, stop.
   - `parseTaskForUser(admin, userId, text)` → `{ ok: false }` → send
     `"Не вдалося розібрати задачу з цього тексту."`, stop.
   - `insertTaskForUser(admin, userId, { title: parsed.title, energyLevel: parsed.energyLevel ?? 1, durationMinutes: parsed.durationMinutes ?? 30, projectId: parsed.projectId, priority: parsed.priority ?? 4, dueDate: parsed.dueDate })`
     — same `?? 1` / `?? 30` fallback convention `quick-add-task-form.tsx`
     already uses for null AI fields.
   - Reply with a confirmation built from the inserted task, e.g.
     `"✅ Додано: «Купити молоко» · завтра · 30 хв"`, omitting parts that
     are null (no due date, no non-default priority).

**`bot.catch()`** — logs unhandled exceptions server-side; where a chat id
is still available, sends `"Щось пішло не так, спробуй ще раз."` (matches
the tone of existing error strings in `actions.ts`).

## Shared logic extraction

`parseTaskWithAI` (in `actions.ts`) currently inlines: get the
cookie-authenticated user, fetch that user's `projects`, build `todayIso`,
call `parseTaskWithOpenRouter`. The webhook needs the identical steps
except with a known `userId` (no cookies) and the admin client. Rather than
copy those four lines into `bot.ts`, `parseTaskForUser` takes the Supabase
client and `userId` as parameters; `parseTaskWithAI` becomes:

```ts
export async function parseTaskWithAI(rawText: string): Promise<ParseTaskResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, rawText };
  return parseTaskForUser(supabase, user.id, rawText);
}
```

Same idea for `addTask` → `insertTaskForUser` (project-ownership check +
insert-with-defaults). This is a same-behavior refactor, not a feature
change to either existing path — verified by the fact that `parseTaskWithAI`
and `addTask`'s signatures, return types, and error strings are unchanged.

## Error handling

| Failure | Behavior |
|---|---|
| `/link` with wrong secret | `"❌ Невірний код."`, no DB write |
| Message from an unlinked `chat.id` | `"Спочатку напиши /link <код>."`, nothing processed |
| Voice file over ~24MB | `"Це голосове занадто велике."`, transcription not attempted |
| Telegram file download fails | Logged, `"Не вдалося розпізнати голосове, спробуй ще раз."` |
| Whisper API error / empty transcript | Same as above |
| `parseTaskForUser` returns `{ ok: false }` | `"Не вдалося розібрати задачу з цього тексту."` |
| `project_id` in parsed result doesn't match a real project | Coerced to `null` — already handled inside `parseTaskWithOpenRouter`, unchanged |
| Supabase insert fails | `"Щось пішло не так, спробуй ще раз."` |
| Any unhandled exception in the `after()` callback | Caught by `bot.catch()`, logged, best-effort error reply |
| Webhook POST without a valid `secretToken` header | Rejected by grammY's `webhookCallback` before any handler runs |

No failure path leaves the user without a reply — every branch above ends
in a Telegram message back to the chat, except a missing/invalid
`secretToken`, which is a rejected request, not a linked chat.

## Testing

No test runner exists in this repo — this follows the existing project
convention (see the AI-capture spec) of manual verification rather than an
automated suite:

1. **Local synthetic webhook call**: POST a hand-built Telegram `Update`
   JSON (a plain text message, e.g. `"Завтра купити молоко"`) at
   `localhost:3000/api/telegram/webhook` with the correct
   `X-Telegram-Bot-Api-Secret-Token` header, for a `chat.id` already linked
   via `/link` in dev, and confirm a row lands in `tasks` and
   `sendMessage` is attempted. Exercises the whole pipeline except the real
   Telegram round-trip and (if skipped) the Whisper call.
2. **Real device test, after this is deployed and reachable on a public
   URL**: register the webhook with `setWebhook` (including the secret
   token), then actually forward a voice message to the bot from a phone
   and confirm the task appears in coralQ with a reasonable title/date.
   This is the one that has to happen for real, not just be claimed — the
   in-app voice recorder shipped earlier without a device test and that's
   an open gap; this feature's whole point is voice-in-Telegram, so it gets
   verified the same way it'll actually be used.
3. `/link` with a wrong secret, then a right one, confirming
   `telegram_chat_id` is set only after the right one.
4. A message from a `chat.id` that was never linked → confirm the "Спочатку
   напиши /link" reply and no DB write.

## Environment / secrets

Add to `.env.local.example` under `# Telegram bot (Block 4)` (names only,
the existing empty `TELEGRAM_BOT_TOKEN` line stays where it is):

- `TELEGRAM_BOT_TOKEN` — already scaffolded; this feature is what finally
  reads it.
- `TELEGRAM_WEBHOOK_SECRET` — passed as grammY's `secretToken`; must match
  what's registered with Telegram via `setWebhook`.
- `TELEGRAM_LINK_SECRET` — the code sent via `/link <secret>`.
- `TELEGRAM_OWNER_EMAIL` — which `public.users` row `/link` writes
  `telegram_chat_id` onto.
- `OPENAI_API_KEY` — new provider (existing AI parsing uses
  `OPENROUTER_API_KEY`; Whisper transcription is a separate OpenAI-specific
  endpoint), server-side only, read only in `transcribe.ts`.

All of the above are server-only — none may be prefixed `NEXT_PUBLIC_` or
read from a `"use client"` file.

## Self-authored decisions (assumptions — user may veto at spec review)

- Transcription model `whisper-1` — matches "OpenAI Whisper API" as stated;
  swapping to `gpt-4o-mini-transcribe` later is a one-string change in
  `transcribe.ts` if quality/cost turns out to matter.
- Plain `fetch()` + `FormData` to OpenAI's `audio/transcriptions` endpoint
  rather than the `openai` npm package — mirrors the existing hand-rolled
  `fetch` call to OpenRouter in `parse-task.ts`; one call site doesn't
  justify an SDK dependency.
- The downloaded voice file is uploaded to OpenAI named `voice.ogg`
  (Telegram voice notes are OGG/Opus in an `.oga` container; confirmed via
  OpenAI's current API reference that `ogg` is an accepted format, so no
  server-side audio conversion is needed).
- `grammy` is the only new npm dependency this feature adds.
