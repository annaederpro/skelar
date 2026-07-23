# Telegram notifications — daily check-in + reply/👍-to-complete — design spec

## Context

coralQ's Telegram bot (`src/lib/telegram/bot.ts`) currently only reacts to
inbound messages: it creates tasks from text/voice and handles account
linking. It never initiates a conversation, and there is no way to interact
with a task once its "✅ Додано" confirmation has been sent — replying to it
does nothing special, it just gets parsed (and fails to parse) as a new task.

This spec adds two related but independently-toggleable-in-effect pieces of
bot-initiated behavior:

1. A gentle once-a-day check-in at 16:00 listing tasks still open for today,
   opt-in via a new Settings toggle.
2. Replying "done" (or a close Ukrainian/English equivalent) or reacting 👍
   to one of the bot's own task-creation confirmation messages marks that
   specific task completed in the app.

Both share the same underlying need — the bot has to *initiate* an outbound
message outside of a request/reply cycle (the digest) and/or *trace a reply
back to a specific task* (the completion feature) — neither of which the
current architecture supports.

## Decisions locked with the user before writing this spec

- **Digest content & trigger**: one message per user per day, sent at a
  fixed 16:00 (Europe/Kyiv, see DST caveat below), listing only tasks still
  `status = 'todo'` with `due_date` = today. If a user has zero such tasks,
  no message is sent at all — no "nothing left today, congrats" noise.
- **Digest is opt-in**: a new `daily_reminder_enabled` column on
  `public.users`, default **false**. Nobody gets pinged without explicitly
  turning it on in Settings.
- **Digest has no reply interaction**: replying to or reacting on the
  digest message does nothing special — it's a plain FYI, not part of the
  completion feature below.
- **Fixed time, no per-user timezone**: 16:00 is the same for every user;
  there's no per-user timezone infrastructure in this app and building one
  is out of scope. The cron is a fixed UTC time tuned for now (see DST
  caveat).
- **Completion trigger scope**: reply/👍 only works on the bot's own
  "✅ Додано" task-creation confirmation messages — nothing else. This
  requires each confirmation to map to exactly one task, so **multi-task
  capture confirmations change from one combined message to one message per
  created task** (previously: `docs/superpowers/specs/2026-07-22-telegram-multi-task-capture-design.md`
  bundled 2+ tasks into a single message with bullet lines — that bundling
  is removed).
- **Completion keywords** (text-reply path, case-insensitive, whole
  trimmed message): `готово`, `зробив`, `зроблено`, `виконано`, `done`.
- **Completion via reaction**: a 👍 reaction added to a confirmation message
  has the same effect as replying with one of the keywords above.

## Non-goals (this pass)

- Per-user configurable notification time — fixed at 16:00 for everyone.
- Per-user timezone support — DST drift (see below) is accepted, not fixed.
- Any interaction on the digest message itself (reply, reaction, snooze).
- Un-completing a task via a reply/reaction (e.g. removing 👍, or replying
  "не готово") — one-directional, matches how the app's own checkbox works
  today (no "undo" affordance requested).
- Marking done via reply/👍 for tasks created through the web app
  (`source = 'app'`) — there's no Telegram confirmation message for those,
  so there's nothing to reply to; this feature only ever applies to
  `source = 'telegram'` tasks.
- Reminders/notifications for anything other than "today's open tasks"
  (no overdue digest, no weekly summary, no per-task due-time reminders).
- Rate-limiting or deduping the cron run itself — matches this repo's
  existing low-stakes-at-this-scale precedent (e.g. no rate limit on
  Telegram link-code generation).

## Architecture and data flow

**Daily digest:**

```
Vercel Cron (vercel.json, fixed UTC time ≈ 16:00 Kyiv)
        │  GET/POST with Authorization: Bearer <CRON_SECRET>
        ▼
/api/cron/daily-reminder/route.ts
        │  verify CRON_SECRET header, else 401
        ▼
admin client: select users
  where daily_reminder_enabled = true and telegram_chat_id is not null
        │
        ▼  for each user
  select tasks where user_id = X, due_date = getAppToday(),
         status = 'todo', released_at is null
        │
        ├─ zero rows → skip, no message sent
        │
        └─ N rows → bot.api.sendMessage(chatId, digest text)
```

**Completion via reply or 👍:**

```
Telegram: bot sends "✅ Додано: «X» · ..." → message_id M is
          written onto that task's telegram_confirmation_message_id
        │
        ▼ (later) user replies to that message, or reacts 👍 on it
        │
message:text handler                    message_reaction handler
  reply_to_message present?               reaction added is 👍?
        │ yes                                    │ yes
        ▼                                        ▼
  look up task by (user_id, reply_to_message.message_id)
        │
        ├─ no match → (text path only) fall through to normal
        │             createTaskFromText flow, unchanged
        │
        └─ match found
              ├─ already completed → gentle no-op reply
              └─ status = 'todo' → update to 'completed',
                                    reply "✅ Зроблено!"
```

## Database

New migration `supabase/migrations/0009_daily_reminder.sql`:

```sql
alter table public.users
  add column if not exists daily_reminder_enabled boolean not null default false;

alter table public.tasks
  add column if not exists telegram_confirmation_message_id bigint;
```

- `daily_reminder_enabled` — no index needed (small `users` table, same
  precedent as every other column added so far). RLS: the existing "Users
  can update own profile" policy already covers this new column.
- `telegram_confirmation_message_id` — nullable, only ever set for
  `source = 'telegram'` tasks, written once right after the confirmation
  `sendMessage` call returns its `message_id`. No index — lookups are by
  `(user_id, telegram_confirmation_message_id)` on a small `tasks` table,
  same no-scale-concern precedent as `telegram_link_code`.

## New/changed code

| File | Change |
|---|---|
| `supabase/migrations/0009_daily_reminder.sql` | New — see above. |
| `src/types/gentle.ts` | `DbUser` gets `daily_reminder_enabled: boolean`. `DbTask` gets `telegram_confirmation_message_id: number \| null`. |
| `src/app/actions.ts` | New export: `updateDailyReminderPreference(enabled: boolean)`. |
| `src/components/gentle/settings-telegram-section.tsx` | Connected state gains a `Switch` (from `src/components/ui/switch.tsx`, currently unused elsewhere) bound to `daily_reminder_enabled`. |
| `src/app/(app)/settings/page.tsx` | Extend the `users` select to include `daily_reminder_enabled`; pass it into `SettingsTelegramSection`. |
| `src/lib/telegram/bot.ts` | `createTaskFromText` sends one message per task instead of one combined confirmation, and records each `message_id`. `message:text` gains a reply-to-completion check before falling through to task creation. New `message_reaction` handler. New shared `tryCompleteFromMessage` helper. |
| `src/app/api/cron/daily-reminder/route.ts` | New. Cron entry point described above. |
| `vercel.json` | New. `crons` array pointing at the route above. |
| `.env.local.example` | Add `CRON_SECRET`. |

## Bot changes (`src/lib/telegram/bot.ts`)

**`createTaskFromText`** — replace the single `buildConfirmation` send with
a loop that sends one message per inserted task and stores its ID:

```ts
for (const task of insertedTasks) {
  const sent = await ctx.api.sendMessage(chatId, `✅ Додано: ${describeTask(task)}`);
  await admin
    .from("tasks")
    .update({ telegram_confirmation_message_id: sent.message_id })
    .eq("id", task.id);
}
if (notSavedCount > 0) {
  await ctx.api.sendMessage(chatId, `⚠️ ${notSavedCount} не вдалося зберегти, спробуй ще раз.`);
}
```

`buildConfirmation` is deleted (no longer needed — `describeTask` alone
covers per-message formatting); `pluralizeTasks` is also deleted (it existed
only to phrase the now-removed combined header). If `insertedTasks.length
=== 0`, behavior is unchanged: `MSG_GENERIC_FAILED`.

**New shared helper**, used by both the text-reply and reaction paths:

```ts
const DONE_KEYWORDS = new Set(["готово", "зробив", "зроблено", "виконано", "done"]);

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
```

**`message:text` handler** — insert a check before the existing
"unknown command" / task-creation logic:

```ts
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  const replyTarget = ctx.message.reply_to_message?.message_id;

  const admin = createAdminClient();
  const chatId = ctx.chat.id;
  const userId = await lookupLinkedUserId(admin, chatId);
  if (!userId) {
    await ctx.reply(MSG_NOT_LINKED);
    return;
  }

  if (replyTarget && DONE_KEYWORDS.has(text.toLowerCase())) {
    const result = await tryCompleteFromMessage(admin, userId, replyTarget);
    if (result !== "not_found") {
      await ctx.reply(result === "completed" ? "✅ Зроблено!" : "Вже позначено готовим 🐠");
      return;
    }
    // not_found → falls through to normal handling below, unchanged
  }

  if (text.startsWith("/")) {
    await ctx.reply("Невідома команда. Надішли текст або голосове із задачею.");
    return;
  }

  after(async () => {
    // ...existing createTaskFromText call, unchanged
  });
});
```

The linked-chat check now runs once, before either branch, replacing the
duplicate lookup that used to happen separately inside task creation — a
pure reordering of existing code, not a behavior change. `not_found`
deliberately falls through rather than erroring — a reply to some other
message that happens to say "готово" (e.g. replying to the digest, or to
an old unrelated message) is not an error case, it's just not a completion
action, so it's treated like any other text and attempted as a new task
(which will most likely fail to parse into anything meaningful and get
`MSG_PARSE_FAILED` — acceptable, matches existing behavior for unparseable
input).

**New `message_reaction` handler:**

```ts
bot.on("message_reaction", async (ctx) => {
  const added = ctx.messageReaction.new_reaction.some(
    (r) => r.type === "emoji" && r.emoji === "👍",
  );
  if (!added) return;

  const admin = createAdminClient();
  const userId = await lookupLinkedUserId(admin, ctx.chat.id);
  if (!userId) return;

  const result = await tryCompleteFromMessage(admin, userId, ctx.messageReaction.message_id);
  if (result === "not_found") return; // reaction on an unrelated message — ignore silently

  await ctx.api.sendMessage(
    ctx.chat.id,
    result === "completed" ? "✅ Зроблено!" : "Вже позначено готовим 🐠",
  );
});
```

Unlike the text path, an unmatched reaction (`not_found`) stays silent —
reacting 👍 on an arbitrary message (e.g. the digest, or a random old
message) isn't a user action directed at the bot in the same way a typed
reply is, so there's no reasonable reply to send back.

**Operational step (not code)**: Telegram only delivers `message_reaction`
updates to a webhook if it was registered with `allowed_updates` including
`"message_reaction"`. After deploying this feature, `setWebhook` must be
re-run (the same manual step used to originally register the webhook, per
the voice-capture spec) with `allowed_updates: ["message", "message_reaction"]`
— this is called out explicitly in the implementation plan so it isn't
missed as a silent no-op in production.

## Cron route (`src/app/api/cron/daily-reminder/route.ts`)

```ts
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const bot = createBot(); // reused for ctx-free outbound sends via bot.api
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

    const lines = tasks.map((t) => `· ${t.title}${t.due_time ? ` о ${formatDueTime(t.due_time)}` : ""}`);
    const header = `🐠 Ще трішки на сьогодні — ${tasks.length} ${pluralizeTasks(tasks.length)}:`;
    await bot.api.sendMessage(user.telegram_chat_id!, [header, ...lines].join("\n")).catch((err) => {
      console.error("daily reminder send failed", user.id, err);
    });
  }

  return new Response("ok");
}
```

Note: `pluralizeTasks` is being deleted from `bot.ts` (see above, it only
existed for the removed combined-confirmation header) — the cron route
needs the same Ukrainian count-agreement logic, so it moves to a small
shared helper (e.g. `src/lib/telegram/pluralize.ts`) rather than being
duplicated inline, since it's now used from two call sites instead of one.

Per-user send failures are caught and logged individually so one bad
`telegram_chat_id` (e.g. user blocked the bot) doesn't stop the loop from
reaching the rest of the users.

## Settings UI

**`src/components/gentle/settings-telegram-section.tsx`** — connected
branch gains:

```tsx
<div className="flex items-center justify-between">
  <label className="text-[13px] text-ink-soft">Нагадування о 16:00, якщо лишились задачі</label>
  <Switch checked={reminderEnabled} onCheckedChange={handleToggle} disabled={saving} />
</div>
```

`handleToggle` calls `updateDailyReminderPreference(next)`; on error, revert
the switch and show the same inline `text-coral` error pattern used
elsewhere on this page. Not shown at all in the disconnected state — the
toggle only appears once `initiallyConnected` is true, since it's
meaningless without a linked chat.

**`src/app/actions.ts`**:

```ts
export async function updateDailyReminderPreference(
  enabled: boolean,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Сесія закінчилась, увійди ще раз." };

  const { error } = await supabase
    .from("users")
    .update({ daily_reminder_enabled: enabled })
    .eq("id", user.id);

  if (error) return { error: "Не вдалося зберегти, спробуй ще раз." };
  return { ok: true };
}
```

## Error handling

| Failure | Behavior |
|---|---|
| Cron request without correct `CRON_SECRET` | `401`, no DB access, no sends |
| A user's `sendMessage` fails during the cron run (e.g. blocked the bot) | Logged, loop continues for remaining users |
| User has zero open tasks today | No message sent at all |
| Reply text matches a done-keyword but doesn't target a tracked confirmation message | Falls through to normal task-creation parsing (unchanged existing behavior for unparseable text) |
| 👍 reaction on a message with no matching task | Silently ignored |
| Reply/👍 on an already-completed task's confirmation | "Вже позначено готовим 🐠", no DB write |
| `updateDailyReminderPreference` called while logged out | `{ error }` — defense-in-depth only, `(app)` routes already redirect |
| Toggle save fails | Switch reverts to its previous state, inline error shown |
| `message_reaction` update never arrives at all | Means the ops step (re-`setWebhook` with `allowed_updates`) wasn't done — flagged explicitly in the plan as a required manual step |

## Testing

No test runner in this repo (established convention) — manual verification:

1. Enable the toggle in Settings, confirm `daily_reminder_enabled = true` in
   the DB; disable it, confirm it flips back.
2. Manually `curl` the cron route with the correct `CRON_SECRET` for a test
   user with 1-2 open tasks due today → confirm the digest message arrives
   and matches the expected format.
3. Same, for a user with zero open tasks today → confirm no message is
   sent.
4. Create a single task via a Telegram text message → confirm exactly one
   confirmation message arrives and `telegram_confirmation_message_id` is
   set on that task's row.
5. Create two tasks in one message (multi-task capture) → confirm **two
   separate** confirmation messages arrive, each with its own
   `telegram_confirmation_message_id`.
6. Reply "готово" to one of those confirmation messages → task flips to
   `completed` in the app, bot replies "✅ Зроблено!". Reply again → "Вже
   позначено готовим 🐠", no duplicate update.
7. React 👍 on a different confirmation message (after re-registering the
   webhook with `allowed_updates` including `message_reaction`) → same
   completion effect, confirmation reply sent.
8. Reply "готово" to some unrelated old message (not a tracked
   confirmation) → falls through, gets the normal "не вдалося розібрати"
   parse-failure behavior, no crash.
9. React 👍 on the digest message → nothing happens (no reply, no DB
   change) — confirms digest messages are excluded from the completion
   feature.

## Environment / secrets

- Add `CRON_SECRET` to `.env.local.example` and to Vercel's environment
  variables — a random string, checked verbatim against the
  `Authorization: Bearer` header Vercel Cron sends automatically when
  `CRON_SECRET` is configured in the project.
- No new secrets needed for the reaction handling — it rides the existing
  `TELEGRAM_BOT_TOKEN`/webhook setup, just with a wider `allowed_updates`
  list (an ops step, not a secret).

## DST caveat

Vercel Cron schedules run in UTC; there is no per-user timezone column in
this app. The cron time is hardcoded for right now (summer, Kyiv = UTC+3),
which will drift to 15:00 local time for roughly half the year (Kyiv
reverts to UTC+2 in winter). Accepted as-is per the user — not solved in
this pass.

## Self-authored decisions (assumptions — user may veto at spec review)

- Digest copy — `"🐠 Ще трішки на сьогодні — {N} {задачу/задачі/задач}:"`
  plus one `· <title>` line per task (with `о <due_time>` appended when
  set) — is a first draft matching the app's existing casual/warm tone
  (`"Привіт! Я додаю задачі в coralQ 🐠"`), explicitly flagged as open to
  wording changes.
- `pluralizeTasks` moves out of `bot.ts` into a small shared
  `src/lib/telegram/pluralize.ts` module since the cron route now needs the
  same logic — a mechanical extraction, not a behavior change.
- Digest lists tasks in whatever order the `select("*")` query returns them
  (insertion order) — no explicit sort by priority/due_time, since the list
  is expected to be short (a handful of items at most) and this wasn't
  discussed.
- "Already completed" reply/reaction responses say "Вже позначено готовим
  🐠" — a new user-facing string not discussed line-by-line, flagged here.
- The completion feature's `message:text` fallthrough (done-keyword reply
  to an untracked message attempts task creation) is deliberate rather than
  silently ignored — treating it as "just text, try to make a task from it"
  keeps the mental model simple (every text message either completes a
  tracked task or attempts to create one, never a third silent-no-op case).
