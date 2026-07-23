# Telegram multi-task capture — design spec

## Context

coralQ's Telegram bot
(`docs/superpowers/specs/2026-07-21-telegram-voice-capture-design.md`) and the
earlier in-browser AI capture
(`docs/superpowers/specs/2026-07-21-ai-task-capture-design.md`) both
explicitly parked "multiple tasks parsed from one input" as a non-goal —
`parseTaskWithOpenRouter`'s JSON schema only ever returns one task object, so
a message describing two distinct intents ("виспатись і подзвонити мамі")
collapses into a single, muddled task today.

This spec lifts that limit, but **only for the Telegram bot**. The web
quick-add dialog (`AddTaskDialog` / `QuickAddTaskForm`) keeps behaving
exactly as a single-task form — it's a manual-review flow where the user
always sees one set of fields before saving, and reworking it into a
multi-draft UI is out of scope here.

## Decisions locked with the user before writing this spec

- **Splitting granularity**: conservative — one distinct intent becomes one
  task. A sentence with several small items of the same kind (e.g. "купити
  хліб і молоко", a single shopping errand) stays **one** task; only clearly
  separate actions (e.g. "виспатись і подзвонити мамі") split into multiple.
- **Confirmation UX**: one combined summary message per incoming Telegram
  message, not one reply per created task.
- **Mechanism**: a single OpenRouter call per message, with the existing
  per-task JSON schema wrapped in a `{ tasks: [...] }` array (schema-driven
  splitting) — not a two-pass "split then parse each" pipeline, and not a
  non-LLM regex pre-split. Same request cost/latency as today.
- **Scope**: Telegram only. The shared `parseTaskWithOpenRouter` function
  returns the richer multi-task shape, but the web path's `parseTaskWithAI`
  (in `src/app/actions.ts`) adapts it back down to a single task
  (`tasks[0]`) so `quick-add-task-form.tsx` / `add-task-dialog.tsx` need
  zero changes.

## Non-goals (this pass)

- No hard cap on the number of tasks extracted from one message — relies on
  the "one intent = one task" prompt instruction rather than an artificial
  ceiling. Revisit only if real usage shows the model over-splitting.
- No change to the web quick-add dialog's UX or the manual form — it keeps
  taking exactly one task's worth of fields, silently ignoring any
  additional tasks the shared parser detected.
- No dedup/merge logic if the same action is mentioned twice in one message.
- No change to `transcribe.ts` — voice-to-text stays a single raw string;
  splitting happens entirely in the parse step.

## Architecture and data flow

```
Telegram message (text or transcribed voice)
        │
        ▼
parseTaskForUser(admin, userId, rawText)   [unchanged signature]
        │
        ▼
parseTaskWithOpenRouter(rawText, projects, todayIso)
        │  one OpenRouter call, response_format = json_schema
        │  schema: { tasks: [ {title, priority, due_date, due_time,
        │                      energy_level, duration_minutes, project_id}, ... ] }
        │  (minItems: 1 — see note below on why Zod, not the schema, is the
        │   real gate)
        ▼
ParseTaskResult = { ok: true; tasks: ParsedTask[] } | { ok: false; rawText }
        │
   ┌────┴─────────────────────────┐
   ▼ (Telegram: bot.ts)           ▼ (Web: actions.ts)
loop, insert each task      parseTaskWithAI takes tasks[0] only,
one combined confirmation   returns old flat single-task shape —
                             quick-add-task-form.tsx unchanged
```

## Schema and prompt changes (`src/lib/ai/parse-task.ts`)

- `RESPONSE_JSON_SCHEMA` and the Zod schema both move from a single task
  object to `{ tasks: <array of the existing per-task object>, minItems: 1
  }`. The per-task field set (`title, priority, due_date, due_time,
  energy_level, duration_minutes, project_id`) is unchanged.
- Note: OpenAI/OpenRouter's strict structured-output mode does not reliably
  enforce array-length keywords like `minItems` — it's included as a hint,
  but the real gate (consistent with how this function already treats Zod
  as "the actual gate" per the original AI-capture spec) is
  `z.array(parsedTaskSchema).min(1)`. A model response with `tasks: []`
  fails Zod validation and falls back to `{ ok: false, rawText }` — the same
  path as any other unparseable input, no new user-facing message needed.
- System prompt: rewritten from "розбираєш... на структуровану задачу"
  (singular) to "на одну або кілька задач", with an explicit rule for the
  conservative-split decision above, plus an example contrasting a
  same-kind list (stays one task) against distinct intents (splits).
- `ParsedTask` (per-task shape) is unchanged. `ParseTaskResult`'s success
  branch becomes `{ ok: true; tasks: ParsedTask[] }`.

## Web path adapter (`src/app/actions.ts`)

`parseTaskWithAI` (used only by the web quick-add dialog) changes from a
passthrough into a small adapter:

```ts
export async function parseTaskWithAI(rawText: string): Promise<ParseSingleTaskResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, rawText };

  const result = await parseTaskForUser(supabase, user.id, rawText);
  if (!result.ok) return result;
  return { ok: true, ...result.tasks[0] };
}
```

`ParseSingleTaskResult` is the old flat-fields type `parseTaskWithAI`
already returned before this spec — kept as-is so `quick-add-task-form.tsx`
(which reads `result.title`, `result.priority`, etc. directly off
`result.ok === true`) needs no changes. If a user dictates two intents into
the web form, only the first becomes the pre-filled draft — same practical
outcome as today (the form only ever held one task's fields).

## Telegram path changes (`src/lib/telegram/bot.ts`)

`createTaskFromText`: replaces the single `insertTaskForUser` call with a
loop over `parsed.tasks`, using the same `?? 1` / `?? 30` / `?? 4`
null-fallback convention already in place, per task. Successfully inserted
tasks accumulate into an array; if that array ends up empty, send the
existing `MSG_GENERIC_FAILED` (unchanged). Otherwise send one combined
confirmation.

`buildConfirmation` is refactored: the per-task formatting (title,
date/time, duration, effort, "важливо" tag) is extracted into
`describeTask(task: DbTask): string`, reused in both branches:

- **Exactly 1 task** — output is byte-identical to today:
  `✅ Додано: «X» · ...`.
- **2+ tasks** — a header line with correctly pluralized Ukrainian count
  (задачу/задачі/задач) followed by one bulleted `describeTask` line per
  task:
  ```
  ✅ Додано 2 задачі:
  · «Виспатись» · 30 хв · легка
  · «Подзвонити мамі» · завтра 15:00 · 15 хв
  ```
- **Partial insert failure** (some of N fail — rare, independent per-row
  inserts): the confirmation covers the successful ones, plus a trailing
  `⚠️ M не вдалося зберегти, спробуй ще раз.` line.

## Error handling

| Failure | Behavior |
|---|---|
| Model returns `tasks: []` | Zod `.min(1)` fails → same as any unparseable input → `MSG_PARSE_FAILED` |
| All parsed tasks fail to insert | `MSG_GENERIC_FAILED` (unchanged message) |
| Some (not all) parsed tasks fail to insert | Combined confirmation for the successes + `⚠️ M не вдалося зберегти` |
| Exactly 1 task parsed | Confirmation format unchanged from current behavior |
| Web dialog's input describes multiple tasks | `parseTaskWithAI` silently returns only `tasks[0]` |

All other rows from the existing Telegram error-handling table (unlinked
chat, oversized voice file, Whisper failure, webhook auth, etc.) are
unchanged by this spec.

## Testing

No test runner in this repo — manual verification, as with every prior
AI-capture feature:

1. "виспатись і подзвонити мамі завтра о 15:00" → 2 tasks, correct per-task
   dates.
2. "купити хліб і молоко" → 1 task (conservative split holds).
3. A voice message with 2-3 distinct spoken intents → same splitting
   through Whisper transcription.
4. A single-intent message → confirmation byte-identical to pre-spec
   behavior.
5. Web quick-add dialog with a multi-intent input → form pre-fills only
   from the first task, no crash.
6. Forced partial insert failure (if practically reproducible) →
   confirmation shows successes + the "⚠️" note; otherwise this branch is
   verified by code review rather than claimed as tested.

## Self-authored decisions (assumptions — user may veto at spec review)

- No cap on tasks per message (see Non-goals).
- Ukrainian pluralization (задачу/задачі/задач) implemented as a small local
  helper rather than a library — this repo has no i18n/pluralization
  dependency and one count noun doesn't justify adding one.
- Partial-insert-failure messaging (`⚠️ M не вдалося зберегти`) is a new
  user-facing string not explicitly discussed line-by-line — flagged here
  in case the wording should change.
