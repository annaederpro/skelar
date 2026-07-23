# Telegram Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in daily 16:00 Telegram check-in listing tasks still
open for today, and let the user mark a task done by replying to (or
reacting 👍 on) the bot's own "✅ Додано" confirmation message for that
task.

**Architecture:** Two new columns (`users.daily_reminder_enabled`,
`tasks.telegram_confirmation_message_id`). The Telegram bot's multi-task
capture changes from one combined confirmation message to one message per
created task, and each sent message's ID is written back onto its task —
this is what makes a later reply/reaction traceable to exactly one task. A
new Vercel Cron route runs once a day, looks up opted-in users with open
tasks due today, and sends each a short digest via the bot's existing `Bot`
instance. A new Settings toggle (inside the existing Telegram card) flips
the opt-in flag.

**Tech Stack:** Existing stack only — grammY (already handles
`message_reaction` updates without any new dependency), Supabase (admin
client for the bot/cron, cookie client for Settings), Next.js Route
Handlers + Vercel Cron (`vercel.json`). No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-07-23-telegram-notifications-design.md`

## Global Constraints

- All user-facing copy is Ukrainian, matching existing tone in
  `src/lib/telegram/bot.ts` (e.g. `"✅ Прив'язано!"`, `"Щось пішло не
  так, спробуй ще раз."`).
- No test runner exists in this repo; each task's gate is `npx tsc
  --noEmit && npm run lint`. Bot-behavior tasks are additionally verified
  with a synthetic webhook `curl` (same technique the multi-task-capture
  feature used — there's no test runner, so this manual check is the
  actual test). The Settings UI task is verified live via the `preview_*`
  tools, not curl.
- Every commit: `git commit --no-gpg-sign` (pinentry cannot prompt in this
  environment).
- The next unused migration number is `0009` (existing: `0001_init.sql` …
  `0008_task_source.sql`).
- Digest is opt-in, default **false** — nobody gets a message without
  turning it on in Settings first.
- Digest send time is fixed at `0 13 * * *` (UTC) in `vercel.json` — this
  is 16:00 Europe/Kyiv during summer DST (EEST, UTC+3). It will read as
  15:00 local in winter (EET, UTC+2) — an accepted, documented limitation,
  not something to "fix" in this plan.
- Completion keywords (text-reply path, case-insensitive, whole trimmed
  message): `готово`, `зробив`, `зроблено`, `виконано`, `done`.
- Multi-task capture (`docs/superpowers/specs/2026-07-22-telegram-multi-task-capture-design.md`)
  changes from one combined confirmation to one message per task — this is
  an intentional, spec'd behavior change, not a regression.
- `src/app/actions.ts` currently ends with `updatePassword` as its last
  export — add the new export after it.
- Digest message never sent when a user has zero open tasks for today —
  no "nothing left, congrats" message.
- Reply/👍 on the digest message does nothing — the completion feature only
  ever looks at `tasks.telegram_confirmation_message_id`, which digest
  messages never set.

---

### Task 1: Migration and type extensions

**Files:**
- Create: `supabase/migrations/0009_daily_reminder.sql`
- Modify: `src/types/gentle.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (all later tasks rely on this): `DbUser.daily_reminder_enabled: boolean`, `DbTask.telegram_confirmation_message_id: number | null`.

- [ ] **Step 1: Create the migration**

```sql
alter table public.users
  add column if not exists daily_reminder_enabled boolean not null default false;

alter table public.tasks
  add column if not exists telegram_confirmation_message_id bigint;
```

Save as `supabase/migrations/0009_daily_reminder.sql`. Apply it to the
project's Supabase instance the same way prior migrations were applied
(the Supabase SQL editor, or however `0001`–`0008` were run — there is no
migration-runner script in this repo). RLS needs no changes: the existing
`"Users can update own profile"` policy (migration `0001`) already covers
the new `users` column, and the bot/cron only ever touch `tasks` through
the service-role admin client, which bypasses RLS.

- [ ] **Step 2: Extend `DbUser` and `DbTask` in `src/types/gentle.ts`**

Find:

```ts
  // Added by migration 0007. Null means the user hasn't set a name yet.
  display_name: string | null;
  created_at: string;
}
```

Replace with:

```ts
  // Added by migration 0007. Null means the user hasn't set a name yet.
  display_name: string | null;
  // Added by migration 0009. Opt-in, default false — no reminder is sent
  // unless the user turns this on in Settings.
  daily_reminder_enabled: boolean;
  created_at: string;
}
```

Find:

```ts
  // Added by migration 0008. Set once at creation; not backfilled for older rows.
  source: "app" | "telegram";
}
```

Replace with:

```ts
  // Added by migration 0008. Set once at creation; not backfilled for older rows.
  source: "app" | "telegram";
  // Added by migration 0009. Set only for source = 'telegram' tasks, right
  // after the bot sends that task's "✅ Додано" confirmation. Lets a later
  // reply/👍 on that exact message be traced back to this task.
  telegram_confirmation_message_id: number | null;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_daily_reminder.sql src/types/gentle.ts
git commit --no-gpg-sign -m "feat: add daily_reminder_enabled and telegram_confirmation_message_id columns"
```

---

### Task 2: Bot sends one confirmation per task and records its message ID

**Files:**
- Create: `src/lib/telegram/pluralize.ts`
- Modify: `src/lib/telegram/bot.ts:105-168`

**Interfaces:**
- Consumes: `DbTask.telegram_confirmation_message_id` (Task 1), `insertTaskForUser` (unchanged, `src/lib/tasks/insert-task.ts`).
- Produces: `pluralizeTasks(n: number): string` (new shared export, used later by Task 5's cron route). `createTaskFromText` keeps its exact signature but now sends N messages instead of 1 combined message and persists each `message_id`.

- [ ] **Step 1: Create `src/lib/telegram/pluralize.ts`**

```ts
// Ukrainian count-noun agreement for "задача": 1 → задачу, 2-4 → задачі
// (except the 12-14 exception), everything else → задач.
export function pluralizeTasks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "задачу";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "задачі";
  return "задач";
}
```

This is a mechanical extraction of the function already in `bot.ts` — no
behavior change. It moves out because Task 5's cron route needs the same
pluralization and `bot.ts` is about to stop needing it locally (see Step
2).

- [ ] **Step 2: Replace the pluralize/confirmation/create-task block in `src/lib/telegram/bot.ts`**

Find (the full block from the old `pluralizeTasks` through the end of
`createTaskFromText` — `describeTask` right above this block is untouched
and stays where it is):

```ts
// Ukrainian count-noun agreement for "задача": 1 → задачу, 2-4 → задачі
// (except the 12-14 exception), everything else → задач.
function pluralizeTasks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "задачу";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "задачі";
  return "задач";
}

// `attemptedCount` may exceed `tasks.length` if some inserts failed (rare,
// independent per-row inserts) — that's reported as a trailing note rather
// than failing the whole confirmation.
function buildConfirmation(tasks: DbTask[], attemptedCount: number): string {
  const notSaved = attemptedCount - tasks.length;
  const failureNote = notSaved > 0 ? `\n⚠️ ${notSaved} не вдалося зберегти, спробуй ще раз.` : "";

  if (tasks.length === 1) {
    return `✅ Додано: ${describeTask(tasks[0])}${failureNote}`;
  }

  const header = `✅ Додано ${tasks.length} ${pluralizeTasks(tasks.length)}:`;
  const lines = tasks.map((task) => `· ${describeTask(task)}`);
  return [header, ...lines].join("\n") + failureNote;
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

  await ctx.api.sendMessage(chatId, buildConfirmation(insertedTasks, parsed.tasks.length));
}
```

Replace with:

```ts
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
```

`buildConfirmation` and the local `pluralizeTasks` are both gone —
`describeTask` (unchanged, still above this block) is now the only
formatting helper `bot.ts` needs for confirmations.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass. (`pluralizeTasks` is not imported into `bot.ts` — it's
only needed by Task 5's cron route — so no unused-import warning should
appear; if lint flags an unused import anywhere, remove it.)

- [ ] **Step 4: Manually verify via a synthetic webhook call**

Same technique as the original multi-task-capture feature's verification —
no test runner exists in this repo, so this is the actual test. Precondition:
dev server running (`preview_start`), `.env.local` has `OPENROUTER_API_KEY`
and `TELEGRAM_WEBHOOK_SECRET`, and a `users` row already linked
(`telegram_chat_id` set).

```bash
curl -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <value of TELEGRAM_WEBHOOK_SECRET>" \
  -d '{
    "update_id": 100000002,
    "message": {
      "message_id": 2,
      "date": 1700000000,
      "chat": { "id": <LINKED_CHAT_ID>, "type": "private" },
      "from": { "id": <LINKED_CHAT_ID>, "is_bot": false, "first_name": "Test" },
      "text": "виспатись і подзвонити мамі завтра о 15:00"
    }
  }'
```

Then query the `tasks` table (via Supabase) for the two rows this just
created and confirm **both** now have a non-null
`telegram_confirmation_message_id`, and that the two values are different
from each other. If `<LINKED_CHAT_ID>` is a real chat you can read, confirm
**two separate** Telegram messages arrived (not one combined list). If it's
a synthetic id, check the dev server logs (`preview_logs`) instead to
confirm two separate `sendMessage` calls were attempted before failing
against the real Telegram API.

If a linked chat/dev DB access isn't available in this environment, do not
claim this was tested — state that plainly.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram/pluralize.ts src/lib/telegram/bot.ts
git commit --no-gpg-sign -m "feat: send one Telegram confirmation per task and record its message id"
```

---

### Task 3: Reply "done" to a confirmation completes that task

**Files:**
- Modify: `src/lib/telegram/bot.ts:37-73` (add helper after `tryLinkChat`)
- Modify: `src/lib/telegram/bot.ts` (the `message:text` handler inside `createBot()`)

**Interfaces:**
- Consumes: `tasks.telegram_confirmation_message_id` (Task 1/2), `lookupLinkedUserId` (unchanged, already in this file).
- Produces: `DONE_KEYWORDS: Set<string>`, `tryCompleteFromMessage(admin, userId, messageId): Promise<"completed" | "already_done" | "not_found">` — Task 4's reaction handler calls this same function.

- [ ] **Step 1: Add `DONE_KEYWORDS` and `tryCompleteFromMessage` in `src/lib/telegram/bot.ts`**

Find (the end of `tryLinkChat`, right before `nextDayIso`):

```ts
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
```

Replace with:

```ts
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

const DONE_KEYWORDS = new Set(["готово", "зробив", "зроблено", "виконано", "done"]);

// Shared by the text-reply and 👍-reaction completion paths: resolves a
// Telegram confirmation message back to the task it announced (only tasks
// created via the bot ever have telegram_confirmation_message_id set), and
// marks it completed.
async function tryCompleteFromMessage(
  admin: SupabaseClient,
  userId: string,
  messageId: number,
): Promise<"completed" | "already_done" | "not_found"> {
  const { data: task } = await admin
    .from("tasks")
    .select("id, status")
    .eq("user_id", userId)
    .eq("telegram_confirmation_message_id", messageId)
    .maybeSingle();

  if (!task) return "not_found";
  if (task.status === "completed") return "already_done";

  await admin.from("tasks").update({ status: "completed" }).eq("id", task.id);
  return "completed";
}

function nextDayIso(iso: string): string {
```

- [ ] **Step 2: Wire the completion check into `message:text`**

Find (inside `createBot()`):

```ts
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
```

Replace with:

```ts
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

    const replyTarget = ctx.message.reply_to_message?.message_id;
    if (replyTarget && DONE_KEYWORDS.has(text.toLowerCase())) {
      const result = await tryCompleteFromMessage(admin, userId, replyTarget);
      if (result !== "not_found") {
        await ctx.reply(result === "completed" ? "✅ Зроблено!" : "Вже позначено готовим 🐠");
        return;
      }
      // not_found → this reply doesn't target a tracked confirmation
      // message (e.g. it's a reply to the digest, or to an old unrelated
      // message) — fall through to normal task creation below, unchanged.
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
```

This preserves every existing branch's ordering exactly (unknown-command
check first, then the linked-chat check) and only inserts the new
completion check in between the linked-chat check and the `after()` call —
so an unlinked user typing a slash command still gets "Невідома команда",
not "Спочатку напиши /link", exactly as before.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 4: Manually verify via synthetic webhook calls**

First, create a task (reuse Task 2 Step 4's `curl`, or send a single-intent
message) and note its confirmation `message_id` — either read it off the
real Telegram reply, or query the `tasks` table for the
`telegram_confirmation_message_id` you just wrote.

Then simulate a reply to that message:

```bash
curl -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <value of TELEGRAM_WEBHOOK_SECRET>" \
  -d '{
    "update_id": 100000003,
    "message": {
      "message_id": 3,
      "date": 1700000000,
      "chat": { "id": <LINKED_CHAT_ID>, "type": "private" },
      "from": { "id": <LINKED_CHAT_ID>, "is_bot": false, "first_name": "Test" },
      "text": "готово",
      "reply_to_message": { "message_id": <CONFIRMATION_MESSAGE_ID>, "date": 1700000000, "chat": { "id": <LINKED_CHAT_ID>, "type": "private" } }
    }
  }'
```

Confirm: the task's `status` flips to `completed` in the DB. Repeat the
same `curl` a second time and confirm the task stays `completed` (no error,
idempotent — check dev server logs for the "Вже позначено готовим" reply
being attempted). Then repeat with a `reply_to_message.message_id` that
doesn't match any task's `telegram_confirmation_message_id` (e.g. `999999`)
and confirm it falls through to the normal parse-failure path instead of
erroring.

If a linked chat/dev DB access isn't available, do not claim this was
tested — state that plainly.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram/bot.ts
git commit --no-gpg-sign -m "feat: replying done/готово to a task confirmation completes it"
```

---

### Task 4: 👍 reaction on a confirmation completes that task

**Files:**
- Modify: `src/lib/telegram/bot.ts` (add a `message_reaction` handler inside `createBot()`)

**Interfaces:**
- Consumes: `tryCompleteFromMessage` (Task 3).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Add the reaction handler**

Find (inside `createBot()`, right after the `message:text` handler and
before the trailing `bot.catch()` comment):

```ts
  // Note: bot.catch() is intentionally not used here — grammY only routes
```

Replace with:

```ts
  bot.on("message_reaction", async (ctx) => {
    const { emojiAdded } = ctx.reactions();
    if (!emojiAdded.includes("👍")) return;

    const admin = createAdminClient();
    const userId = await lookupLinkedUserId(admin, ctx.chat.id);
    if (!userId) return;

    const result = await tryCompleteFromMessage(admin, userId, ctx.messageReaction.message_id);
    if (result === "not_found") return; // reaction on an unrelated message — stay silent

    await ctx.api.sendMessage(
      ctx.chat.id,
      result === "completed" ? "✅ Зроблено!" : "Вже позначено готовим 🐠",
    );
  });

  // Note: bot.catch() is intentionally not used here — grammY only routes
```

`ctx.reactions()` is grammY's built-in helper that diffs `old_reaction`
against `new_reaction` and returns `emojiAdded` (only what was newly added
in this specific update, not what was already present) — this is why it's
used instead of just checking whether `new_reaction` contains 👍, which
would also match a reaction the user already had before an unrelated
change. Unlike the text-reply path, an unmatched reaction (`not_found`)
stays silent — there's no reasonable reply to send back for a 👍 on some
arbitrary old message.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass. If `tsc` complains that `ctx.messageReaction` might be
undefined, that means grammY's `Filter<C, "message_reaction">` narrowing
isn't applying as expected inside `bot.on("message_reaction", ...)` — check
the installed `grammy` version's `context.d.ts` for `ReactionContext` before
falling back to a non-null assertion (`ctx.messageReaction!.message_id`).

- [ ] **Step 3: Manually verify via a synthetic webhook call**

Using the same confirmation `message_id` from Task 3's verification (or a
fresh one), simulate a 👍 reaction update:

```bash
curl -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <value of TELEGRAM_WEBHOOK_SECRET>" \
  -d '{
    "update_id": 100000004,
    "message_reaction": {
      "chat": { "id": <LINKED_CHAT_ID>, "type": "private" },
      "message_id": <CONFIRMATION_MESSAGE_ID>,
      "date": 1700000000,
      "old_reaction": [],
      "new_reaction": [{ "type": "emoji", "emoji": "👍" }]
    }
  }'
```

Confirm the corresponding task flips to `completed` in the DB (use a task
that isn't already completed from a prior step). Then simulate a
reaction on an untracked message id (e.g. `999999`) and confirm nothing
changes and no reply is attempted (check `preview_logs`).

- [ ] **Step 4: Re-register the webhook with `message_reaction` in `allowed_updates`**

This is a required **operational step**, not optional cleanup — Telegram
does not deliver `message_reaction` updates to a webhook unless it was
registered with `allowed_updates` explicitly including it. Without this
step, Step 3's synthetic test still passes (it POSTs directly to the local
route, bypassing Telegram entirely) but real 👍 taps from an actual device
will silently never arrive.

```bash
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  --data-urlencode "url=https://<public-host>/api/telegram/webhook" \
  --data-urlencode "secret_token=<TELEGRAM_WEBHOOK_SECRET value>" \
  --data-urlencode 'allowed_updates=["message","message_reaction"]'
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`. Then:

```bash
curl -s "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

Expected: `allowed_updates` in the response includes `"message_reaction"`.
If this environment can't reach a real deployment to run this against, do
not claim it was done — flag it explicitly as an outstanding step for
whoever deploys this feature.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram/bot.ts
git commit --no-gpg-sign -m "feat: 👍 reaction on a task confirmation completes it"
```

---

### Task 5: Daily 16:00 digest cron route

**Files:**
- Create: `src/app/api/cron/daily-reminder/route.ts`
- Create: `vercel.json`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: `pluralizeTasks` (Task 2), `createBot` (unchanged, exported from `src/lib/telegram/bot.ts`), `createAdminClient` (unchanged, `src/lib/supabase/admin.ts`), `getAppToday` (unchanged, `src/lib/date.ts`), `formatDueTime` (unchanged, `src/types/gentle.ts`), `daily_reminder_enabled` (Task 1).
- Produces: `GET /api/cron/daily-reminder` — not consumed by any other task in this plan, only by Vercel Cron.

- [ ] **Step 1: Create the cron route**

```ts
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
```

Per-user send failures are caught and logged individually so one bad chat
(e.g. a user who blocked the bot) doesn't stop the loop from reaching the
rest of the users.

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-reminder",
      "schedule": "0 13 * * *"
    }
  ]
}
```

`0 13 * * *` is UTC — 16:00 Europe/Kyiv during summer DST (see Global
Constraints for the winter-drift caveat).

- [ ] **Step 3: Add `CRON_SECRET` to `.env.local.example`**

Find:

```
# Telegram bot (Block 4)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=
```

Replace with:

```
# Telegram bot (Block 4)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=

# Daily reminder cron (checked against Vercel Cron's Authorization header)
CRON_SECRET=
```

Also set `CRON_SECRET` to a real random value in `.env.local` and in
Vercel's project environment variables (a random string is sufficient —
Vercel sends it verbatim as `Authorization: Bearer <CRON_SECRET>` when the
project has this env var configured and a `crons` entry in `vercel.json`).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 5: Manually verify the cron route**

Preconditions: dev server running (`preview_start`), `CRON_SECRET` set in
`.env.local`, at least one linked user with `daily_reminder_enabled = true`
(set it directly via SQL for this test — the Settings toggle UI is Task 6)
and at least one task with `due_date` = today, `status = 'todo'`,
`released_at is null`.

```bash
curl -i http://localhost:3000/api/cron/daily-reminder \
  -H "Authorization: Bearer <CRON_SECRET value>"
```

Expected: `200 ok`. Check `preview_logs` for any per-user send errors. If
the linked chat is real, confirm the digest message arrives formatted as
`🐠 Ще трішки на сьогодні — N задачу/задачі/задач:` followed by one `·`
line per task. Then flip that user's open tasks to none due today (or
temporarily set `daily_reminder_enabled = false`) and re-run the same
`curl` — confirm no message is sent for that user this time.

Also verify the auth guard:

```bash
curl -i http://localhost:3000/api/cron/daily-reminder
```

Expected: `401 Unauthorized`, no DB queries attempted (check
`preview_logs` shows nothing beyond the 401).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/daily-reminder/route.ts vercel.json .env.local.example
git commit --no-gpg-sign -m "feat: add daily 16:00 Telegram reminder cron"
```

---

### Task 6: Settings toggle for the daily reminder

**Files:**
- Modify: `src/app/actions.ts` (add `updateDailyReminderPreference` after `updatePassword`)
- Modify: `src/components/gentle/settings-telegram-section.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `daily_reminder_enabled` (Task 1), `Switch` (existing, unused-until-now `src/components/ui/switch.tsx`).
- Produces: `updateDailyReminderPreference(enabled: boolean): Promise<{ ok: true } | { error: string }>` — not consumed elsewhere in this plan, only by the component below.

- [ ] **Step 1: Add the Server Action**

Append to the end of `src/app/actions.ts` (after `updatePassword`):

```ts
export async function updateDailyReminderPreference(
  enabled: boolean,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("users")
    .update({ daily_reminder_enabled: enabled })
    .eq("id", user.id);

  if (error) {
    return { error: "Не вдалося зберегти, спробуй ще раз." };
  }

  return { ok: true };
}
```

- [ ] **Step 2: Replace `src/components/gentle/settings-telegram-section.tsx`**

Find (full current file):

```tsx
"use client";

import { useState } from "react";
import { disconnectTelegram } from "@/app/actions";
import { TelegramConnectCard } from "@/components/gentle/telegram-connect-card";

export function SettingsTelegramSection({ initiallyConnected }: { initiallyConnected: boolean }) {
  const [connected, setConnected] = useState(initiallyConnected);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async () => {
    setError(null);
    const result = await disconnectTelegram();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setConnected(false);
  };

  if (connected) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-muted p-4">
        <p className="text-[15px] font-bold text-ink">✅ Telegram підключено</p>
        {error && <p className="text-[13px] text-coral">{error}</p>}
        <button
          type="button"
          onClick={disconnect}
          className="self-start rounded-full bg-paper px-3 py-1.5 text-[13px] font-bold text-ink-soft"
        >
          Відключити
        </button>
      </div>
    );
  }

  return <TelegramConnectCard />;
}
```

Replace with:

```tsx
"use client";

import { useState } from "react";
import { disconnectTelegram, updateDailyReminderPreference } from "@/app/actions";
import { TelegramConnectCard } from "@/components/gentle/telegram-connect-card";
import { Switch } from "@/components/ui/switch";

export function SettingsTelegramSection({
  initiallyConnected,
  initialDailyReminderEnabled,
}: {
  initiallyConnected: boolean;
  initialDailyReminderEnabled: boolean;
}) {
  const [connected, setConnected] = useState(initiallyConnected);
  const [reminderEnabled, setReminderEnabled] = useState(initialDailyReminderEnabled);
  const [error, setError] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const disconnect = async () => {
    setError(null);
    const result = await disconnectTelegram();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setConnected(false);
  };

  const toggleReminder = async (next: boolean) => {
    setReminderError(null);
    setReminderEnabled(next);
    const result = await updateDailyReminderPreference(next);
    if ("error" in result) {
      setReminderEnabled(!next);
      setReminderError(result.error);
    }
  };

  if (connected) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
        <p className="text-[15px] font-bold text-ink">✅ Telegram підключено</p>
        {error && <p className="text-[13px] text-coral">{error}</p>}
        <button
          type="button"
          onClick={disconnect}
          className="self-start rounded-full bg-paper px-3 py-1.5 text-[13px] font-bold text-ink-soft"
        >
          Відключити
        </button>
        <div className="flex items-center justify-between border-t border-paper pt-3">
          <label className="text-[13px] text-ink-soft">
            Нагадування о 16:00, якщо лишились задачі
          </label>
          <Switch checked={reminderEnabled} onCheckedChange={toggleReminder} />
        </div>
        {reminderError && <p className="text-[13px] text-coral">{reminderError}</p>}
      </div>
    );
  }

  return <TelegramConnectCard />;
}
```

The toggle only renders in the connected branch — meaningless without a
linked chat, so it isn't shown at all in the disconnected state.

- [ ] **Step 3: Wire the new prop in `src/app/(app)/settings/page.tsx`**

Find:

```tsx
  const { data: profile } = await supabase
    .from("users")
    .select("telegram_chat_id, display_name")
    .eq("id", userId)
    .single();
```

Replace with:

```tsx
  const { data: profile } = await supabase
    .from("users")
    .select("telegram_chat_id, display_name, daily_reminder_enabled")
    .eq("id", userId)
    .single();
```

Find:

```tsx
      <SettingsTelegramSection initiallyConnected={Boolean(profile?.telegram_chat_id)} />
```

Replace with:

```tsx
      <SettingsTelegramSection
        initiallyConnected={Boolean(profile?.telegram_chat_id)}
        initialDailyReminderEnabled={profile?.daily_reminder_enabled ?? false}
      />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass. `npm run build` is included here (not just `tsc`)
because this task wires a Server Component to a Client Component prop
change, matching this repo's existing precedent for that kind of change
(see the settings-account-password plan's Task 5).

- [ ] **Step 5: Manually verify in the browser**

This is a browser-testable UI change — use the `preview_*` tools, not
Bash/curl.

1. `preview_start` the dev server, log in as a user with Telegram already
   connected, open `/settings`.
2. Confirm the Telegram card now shows a "Нагадування о 16:00..." row with
   a toggle, below the Відключити button.
3. `preview_snapshot` to confirm the toggle's initial state matches the
   DB's current `daily_reminder_enabled` value for that user.
4. `preview_click` the toggle → `preview_snapshot` again to confirm it
   flips visually, then reload the page and confirm it persisted (query the
   `users` row directly, or just re-check the toggle's state after reload).
5. Log in as a user with Telegram **not** connected, open `/settings`,
   confirm the reminder toggle does not appear at all (only the connect
   card shows).

- [ ] **Step 6: Commit**

```bash
git add src/app/actions.ts src/components/gentle/settings-telegram-section.tsx "src/app/(app)/settings/page.tsx"
git commit --no-gpg-sign -m "feat: add Settings toggle for the daily Telegram reminder"
```

---

## Self-Review Notes

- **Spec coverage:** DB columns + types (Task 1); per-task confirmations +
  message-id persistence, replacing the multi-task-capture spec's combined
  message (Task 2); text-reply completion with the exact keyword list and
  fallthrough behavior (Task 3); 👍-reaction completion plus the
  `allowed_updates` operational step (Task 4); opt-in cron digest with the
  zero-tasks-skip rule and the DST caveat (Task 5); Settings toggle scoped
  to the connected state only (Task 6). All spec sections are covered.
- **Placeholder scan:** none — every step has complete code, exact `Find`/
  `Replace` blocks, exact commands, and concrete expected output.
- **Type consistency:** `tryCompleteFromMessage`'s return type
  (`"completed" | "already_done" | "not_found"`, Task 3) is consumed
  identically by both the text-reply branch (Task 3) and the reaction
  handler (Task 4) — same three-way switch, same reply strings. `pluralizeTasks`
  (Task 2, moved to `src/lib/telegram/pluralize.ts`) is imported with the
  same name and signature by the cron route (Task 5) — no drift.
  `daily_reminder_enabled` (Task 1) flows unchanged in name and type through
  the Server Action (Task 6), the Settings page fetch (Task 6), and the cron
  route's query filter (Task 5).
