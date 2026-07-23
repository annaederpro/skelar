# Telegram Multi-Task Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one Telegram message (text or voice) create more than one coralQ
task, when the message describes more than one distinct intent.

**Architecture:** `parseTaskWithOpenRouter` moves from a single-object JSON
schema to a `{ tasks: [...] }` array schema (one OpenRouter call, unchanged
cost/latency). The Telegram bot loops over the returned tasks and inserts
each one, then sends one combined confirmation. The web quick-add dialog is
untouched — the shared parser's web-facing wrapper (`parseTaskWithAI`) keeps
returning exactly one task (the first), preserving its existing type and
behavior byte-for-byte.

**Tech Stack:** Next.js Server Actions + Route Handler, grammY (Telegram),
Supabase, Zod, OpenRouter (structured JSON output). No new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-22-telegram-multi-task-capture-design.md`.
- No test runner exists in this repo (no jest/vitest/tsx) — verification is
  `npx tsc --noEmit` for types, plus manual/live checks for behavior. Do not
  introduce a test framework as part of this work.
- No new npm dependencies.
- All user-facing strings are Ukrainian, matching existing tone in
  `src/lib/telegram/bot.ts`.
- `ParseTaskResult` (the flat, single-task type in `src/lib/ai/parse-task.ts`)
  must keep its current name **and** shape unchanged — `quick-add-task-form.tsx`
  imports it and must require zero changes. The new multi-task shape is a
  separate type, `ParseTaskListResult`.
- Telegram-only scope: the web quick-add dialog's UX and the manual task
  form are not modified in any way.
- No cap on the number of tasks extracted from one message.
- Splitting rule (goes in the LLM prompt): one distinct intent = one task.
  Several small items of the same kind in one sentence (e.g. "купити хліб і
  молоко") stay one task; only clearly separate actions split.

---

### Task 1: Multi-task schema, types, and prompt in `parse-task.ts`

**Files:**
- Modify: `src/lib/ai/parse-task.ts` (full file rewrite — every symbol in it changes or moves)

**Interfaces:**
- Consumes: nothing new (same `zod` import already in the file).
- Produces:
  - `ParsedTask` — unchanged shape, still exported.
  - `ParseTaskResult` — unchanged name **and** shape: `({ ok: true } & ParsedTask) | { ok: false; rawText: string }`. Still exported, still what `quick-add-task-form.tsx` expects.
  - `ParseTaskListResult` (new) — `{ ok: true; tasks: ParsedTask[] } | { ok: false; rawText: string }`.
  - `parseTaskWithOpenRouter(rawText: string, projects: OpenRouterProject[], todayIso: string): Promise<ParseTaskListResult>` — same params, **changed return type** (was `ParseTaskResult`, now `ParseTaskListResult`).

- [ ] **Step 1: Replace the full contents of `src/lib/ai/parse-task.ts`**

```ts
import { z } from "zod";

export interface OpenRouterProject {
  id: string;
  name: string;
}

const parsedTaskSchema = z.object({
  title: z.string().min(1),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  due_date: z.string().nullable(),
  due_time: z.string().nullable(),
  energy_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  duration_minutes: z.number().int().positive().nullable(),
  project_id: z.string().nullable(),
});

const parsedTaskListSchema = z.object({
  tasks: z.array(parsedTaskSchema).min(1),
});

export type ParsedTask = {
  title: string;
  priority: 1 | 2 | 3 | 4 | null;
  dueDate: string | null;
  dueTime: string | null;
  energyLevel: 1 | 2 | 3 | null;
  durationMinutes: number | null;
  projectId: string | null;
};

// Unchanged on purpose: src/components/gentle/quick-add-task-form.tsx
// imports this exact type for its single-task AI-prefill flow.
export type ParseTaskResult = ({ ok: true } & ParsedTask) | { ok: false; rawText: string };

// New multi-task shape — used by parseTaskForUser and the Telegram bot.
export type ParseTaskListResult =
  | { ok: true; tasks: ParsedTask[] }
  | { ok: false; rawText: string };

const TASK_ITEM_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    priority: { type: ["integer", "null"], enum: [1, 2, 3, 4, null] },
    due_date: {
      type: ["string", "null"],
      description: "ISO date YYYY-MM-DD, or null if no date was mentioned",
    },
    due_time: {
      type: ["string", "null"],
      description: "24-hour HH:MM, or null if no time of day was mentioned",
    },
    energy_level: { type: ["integer", "null"], enum: [1, 2, 3, null] },
    duration_minutes: { type: ["integer", "null"] },
    project_id: { type: ["string", "null"] },
  },
  required: [
    "title",
    "priority",
    "due_date",
    "due_time",
    "energy_level",
    "duration_minutes",
    "project_id",
  ],
  additionalProperties: false,
};

// `minItems` is a hint for the model, not an enforced guarantee — OpenAI /
// OpenRouter structured-output strict mode doesn't reliably enforce
// array-length keywords. `parsedTaskListSchema`'s `.min(1)` below is the
// real gate: a `tasks: []` response fails validation and becomes
// `{ ok: false, rawText }`, same as any other unparseable input.
const RESPONSE_JSON_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "parsed_task_list",
    strict: true,
    schema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          minItems: 1,
          items: TASK_ITEM_JSON_SCHEMA,
        },
      },
      required: ["tasks"],
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(projects: OpenRouterProject[], todayIso: string): string {
  const projectList = projects.length
    ? projects.map((p) => `- ${p.name} (id: ${p.id})`).join("\n")
    : "(жодного проєкту немає — завжди повертай project_id: null)";

  return [
    "Ти розбираєш вільний текст користувача (написаний або сказаний вголос) на одну або кілька структурованих задач для таск-менеджера.",
    "Кожна задача — окремий об'єкт у масиві tasks.",
    "Правило розбиття: одна задача на один ЧІТКО ОКРЕМИЙ намір/дію. Якщо в тексті кілька дрібних пунктів ОДНОГО роду (наприклад, список покупок: 'купити хліб і молоко') — це ОДНА задача, не розбивай по пунктах. Але якщо згадано кілька різних дій ('виспатись і подзвонити мамі') — це дві окремі задачі.",
    `Сьогоднішня дата: ${todayIso} (YYYY-MM-DD). Використовуй її, щоб перевести відносні дати ("завтра", "у п'ятницю") у конкретну ISO-дату due_date.`,
    "Поля кожної задачі:",
    "- title: коротка назва задачі (обов'язково, не порожня).",
    "- priority: 1 (дуже важливо), 2 або 3 (звичайне), 4 (колись/неважливо), або null якщо незрозуміло.",
    "- due_date: ISO-дата YYYY-MM-DD, або null якщо дата не згадана.",
    "- due_time: час доби у 24-годинному форматі HH:MM ('о 15:00' → '15:00'), або null якщо час не згадано. Ніколи не вигадуй час.",
    "- Якщо згадано час, але не дату — постав due_date на сьогодні.",
    "- energy_level: 1 (легка задача), 2 (середня), 3 (потребує глибокого фокусу), або null якщо незрозуміло.",
    "- duration_minutes: орієнтовна тривалість у хвилинах, або null якщо не згадано.",
    "- project_id: id одного з проєктів користувача, ЯКЩО текст явно згадує його назву. Інакше null.",
    "Доступні проєкти користувача:",
    projectList,
    "Кожна задача завжди має всі сім полів. Якщо щось невідомо — null, не вигадуй значення.",
  ].join("\n");
}

function toParsedTask(
  data: z.infer<typeof parsedTaskSchema>,
  projects: OpenRouterProject[],
  todayIso: string,
): ParsedTask {
  const validProjectIds = new Set(projects.map((p) => p.id));
  const projectId =
    data.project_id && validProjectIds.has(data.project_id) ? data.project_id : null;

  // A malformed time degrades to null rather than failing the whole parse;
  // a time without a date gets today's date (mirrors the prompt rule).
  const rawTime = data.due_time;
  const dueTime =
    rawTime && /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime) ? rawTime.slice(0, 5) : null;

  return {
    title: data.title,
    priority: data.priority,
    dueDate: data.due_date ?? (dueTime ? todayIso : null),
    dueTime,
    energyLevel: data.energy_level,
    durationMinutes: data.duration_minutes,
    projectId,
  };
}

export async function parseTaskWithOpenRouter(
  rawText: string,
  projects: OpenRouterProject[],
  todayIso: string,
): Promise<ParseTaskListResult> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, rawText: trimmed };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, rawText: trimmed };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: buildSystemPrompt(projects, todayIso) },
          { role: "user", content: trimmed },
        ],
        response_format: RESPONSE_JSON_SCHEMA,
      }),
    });

    if (!response.ok) {
      return { ok: false, rawText: trimmed };
    }

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { ok: false, rawText: trimmed };
    }

    const parsedJson = JSON.parse(content);
    const result = parsedTaskListSchema.safeParse(parsedJson);
    if (!result.success) {
      return { ok: false, rawText: trimmed };
    }

    return {
      ok: true,
      tasks: result.data.tasks.map((task) => toParsedTask(task, projects, todayIso)),
    };
  } catch {
    return { ok: false, rawText: trimmed };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: fails here, because `src/lib/ai/parse-task-for-user.ts` (Task 2) still declares `Promise<ParseTaskResult>` while `parseTaskWithOpenRouter` now returns `ParseTaskListResult` — this is expected and resolved by Task 2, not a bug in this step. Confirm the *only* errors reported are in `parse-task-for-user.ts` (and, transitively, its callers) — no errors inside `parse-task.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/parse-task.ts
git commit -m "feat: parse Telegram/AI capture text into multiple tasks"
```

---

### Task 2: Update the shared wrapper and the web adapter

**Files:**
- Modify: `src/lib/ai/parse-task-for-user.ts` (full file, small change)
- Modify: `src/app/actions.ts:384-395` (`parseTaskWithAI` body only)

**Interfaces:**
- Consumes: `ParseTaskListResult`, `ParsedTask`, `ParseTaskResult` from Task 1.
- Produces:
  - `parseTaskForUser(supabase: SupabaseClient, userId: string, rawText: string): Promise<ParseTaskListResult>` — same params, changed return type.
  - `parseTaskWithAI(rawText: string): Promise<ParseTaskResult>` — **signature and return type unchanged** from before this plan; only its body changes.

- [ ] **Step 1: Replace the full contents of `src/lib/ai/parse-task-for-user.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTaskWithOpenRouter, type ParseTaskListResult } from "@/lib/ai/parse-task";
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
): Promise<ParseTaskListResult> {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", userId);

  return parseTaskWithOpenRouter(rawText, projects ?? [], getAppToday());
}
```

- [ ] **Step 2: Replace `parseTaskWithAI` in `src/app/actions.ts`**

Find (around line 384):

```ts
export async function parseTaskWithAI(rawText: string): Promise<ParseTaskResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, rawText };
  }

  return parseTaskForUser(supabase, user.id, rawText);
}
```

Replace with:

```ts
export async function parseTaskWithAI(rawText: string): Promise<ParseTaskResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, rawText };
  }

  const result = await parseTaskForUser(supabase, user.id, rawText);
  if (!result.ok) {
    return result;
  }
  // The web quick-add dialog only ever shows one task's fields — if the
  // input described more than one intent, only the first is used.
  return { ok: true, ...result.tasks[0] };
}
```

No import changes needed in `actions.ts` — `ParseTaskResult` is already imported at line 5 and keeps the same meaning.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project. If `src/lib/telegram/bot.ts` now shows errors about `parsed.title`/`parsed.priority` not existing — that's expected and is resolved by Task 3, not a bug here. Confirm zero errors outside `src/lib/telegram/bot.ts`.

- [ ] **Step 4: Manually verify the web quick-add dialog is unaffected**

Start the dev server and open the app in a browser (use this project's `preview_start` / `preview_*` tools, not raw `next dev` in a terminal). Open the task-creation dialog (FAB → "Нова задача"), switch to AI mode, and:
- Type a single-intent input (e.g. "купити хліб завтра") → confirm the form pre-fills title/date exactly as it did before this change.
- Type a two-intent input (e.g. "виспатись і подзвонити мамі") → confirm the form pre-fills using only the first detected task, with no crash and no leftover text from the second intent.

If no authenticated session is available in this environment to reach the dialog, do not claim this was verified — state plainly that it was checked by code review and typecheck only, and flag that a live check is still needed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/parse-task-for-user.ts src/app/actions.ts
git commit -m "feat: adapt shared task parser to the new multi-task shape"
```

---

### Task 3: Telegram bot inserts every parsed task and sends one summary

**Files:**
- Modify: `src/lib/telegram/bot.ts:72-125` (`buildConfirmation` and `createTaskFromText`)

**Interfaces:**
- Consumes: `parseTaskForUser` returning `ParseTaskListResult` (Task 2), `ParsedTask` (Task 1), `insertTaskForUser` (unchanged, from `src/lib/tasks/insert-task.ts`).
- Produces: internal-only — `describeTask`, `pluralizeTasks`, updated `buildConfirmation`, updated `createTaskFromText`. Nothing outside this file calls any of them.

- [ ] **Step 1: Replace `buildConfirmation` in `src/lib/telegram/bot.ts`**

Find (around line 72):

```ts
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
```

Replace with:

```ts
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
```

- [ ] **Step 2: Replace `createTaskFromText` in `src/lib/telegram/bot.ts`**

Find (around line 97):

```ts
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
```

Replace with:

```ts
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

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project (this closes out the errors expected-but-not-fixed in Task 1/2's typecheck steps).

- [ ] **Step 4: Manually verify via a synthetic webhook call**

This exercises the real pipeline (real OpenRouter call, real DB insert, real confirmation text) the same way the original Telegram voice-capture feature was verified — there's no test runner in this repo, so this manual check is the actual test.

Preconditions: dev server running (`preview_start`), `OPENROUTER_API_KEY` and `TELEGRAM_WEBHOOK_SECRET` set in `.env.local`, and a `users` row already linked (`telegram_chat_id` set — link one via a real `/link <code>` message first if none exists; see `src/components/gentle/telegram-connect-card.tsx` for how a code is generated).

```bash
curl -X POST http://localhost:3000/api/telegram/webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: <value of TELEGRAM_WEBHOOK_SECRET>" \
  -d '{
    "update_id": 100000001,
    "message": {
      "message_id": 1,
      "date": 1700000000,
      "chat": { "id": <LINKED_CHAT_ID>, "type": "private" },
      "from": { "id": <LINKED_CHAT_ID>, "is_bot": false, "first_name": "Test" },
      "text": "виспатись і подзвонити мамі завтра о 15:00"
    }
  }'
```

Replace `<LINKED_CHAT_ID>` with the real linked `telegram_chat_id` value. Then:
- Query the `tasks` table (via Supabase) for that user and confirm **two** new rows: one titled around "Виспатись" (`due_date`/`due_time` null), one around "Подзвонити мамі" (`due_date` = tomorrow, `due_time` = "15:00").
- If `<LINKED_CHAT_ID>` is a chat you can actually read in Telegram, confirm the combined `✅ Додано 2 задачі: ...` message arrives. If it's a synthetic id Telegram doesn't recognize, `sendMessage` will fail against the real Telegram API after the DB rows are already written — check the dev server logs instead (`preview_logs`) to confirm `buildConfirmation` produced the expected two-line text before the send attempt failed.
- Repeat with a same-kind input, e.g. "купити хліб і молоко" → confirm it stays **one** task, not two — this is the conservative-split behavior locked in the spec.

If a linked chat/dev DB access isn't available in this environment, do not claim this was tested — state that plainly and note it as the one thing that still needs a real run, exactly as the original voice-capture feature's spec flagged its own device-test gap.

- [ ] **Step 5: Commit**

```bash
git add src/lib/telegram/bot.ts
git commit -m "feat: insert every task the Telegram bot parses from one message"
```

---

## Self-Review Notes

- **Spec coverage:** schema/prompt change (Task 1), web-path non-regression via kept `ParseTaskResult` (Task 1 + 2), insert loop + combined confirmation + pluralization + partial-failure note (Task 3), all covered.
- **Placeholder scan:** none — every step has complete code, exact commands, and concrete expected output.
- **Type consistency:** `ParseTaskListResult` (Task 1) → consumed unchanged by `parseTaskForUser`'s return type (Task 2) → consumed as `parsed.tasks` in `createTaskFromText` (Task 3). `ParseTaskResult` (Task 1, unchanged shape) → returned unchanged by `parseTaskWithAI` (Task 2) → never touched by Task 3. No naming drift between tasks.
