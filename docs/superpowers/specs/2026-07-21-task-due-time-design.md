# Task due time — design spec

## Context

coralQ tasks have an optional `due_date` (plain `date` column, ISO
`YYYY-MM-DD` strings end-to-end). The user wants to optionally attach a
**time of day** to a task as well ("зателефонувати завтра о 15:00").

Decisions locked with the user:

- **Time is optional**, layered on top of the optional date: a task may
  have no date, a date only, or a date + time. Never a time without a date.
- **Form UI is a toggle-to-reveal**: a small "+ час" chip next to the date
  field expands into a time input, keeping the compact dialog uncluttered
  for the common no-time case.
- **Within a day, no-time tasks sort first, then timed tasks ascending** —
  matching the existing "no due date first" convention on Inbox.
- **The AI capture parser is extended** to extract a spoken/typed time in
  the same pass that already extracts the date.

## Architecture decision

**Additive `due_time time` column** beside the existing `due_date date`
column — NOT a merge into a single `timestamptz`. The whole app (Today's
exact-day match, Upcoming's day grouping, overdue detection, WeekStrip
busy-dates) compares plain ISO date strings against `getAppToday()`'s
Europe/Kyiv day boundary. A timestamptz migration would force timezone
day-boundary recomputation at every read site and a data conversion, with
off-by-one-day risk, for a display-only feature. Additive column = zero
change to existing date semantics, one-line migration, consistent with how
this schema has grown (0002, 0003).

## Schema

`supabase/migrations/0004_due_time.sql`:

```sql
alter table public.tasks
  add column if not exists due_time time;

do $$ begin
  alter table public.tasks
    add constraint tasks_due_time_requires_due_date
    check (due_time is null or due_date is not null);
exception when duplicate_object then null; end $$;
```

The check constraint is defense-in-depth; the UI prevents the invalid
state. The `do $$ ... duplicate_object` guard keeps the file re-runnable,
matching 0001's enum-guard style.

## Types & helpers (`src/types/gentle.ts`)

- `DbTask.due_time: string | null` — Supabase returns `time` as
  `"HH:MM:SS"`.
- `formatDueTime(time: string): string` — trims `"HH:MM:SS"` →
  `"HH:MM"` for both card display and `<input type="time">` value
  round-tripping (the input produces `"HH:MM"`, which Postgres accepts
  back directly).

## Form UI (`task-fields-form.tsx`)

New controlled props: `dueTime: string` (empty = none, else `"HH:MM"`) and
`onDueTimeChange`.

- No date picked → no time UI at all.
- Date picked, no time → small "+ час" chip button next to the date field.
- Chip tapped → `<input type="time">` revealed (local `isExpanded` state,
  initialized `true` when the incoming `dueTime` is non-empty so editing a
  task that already has a time shows the input immediately).
- An "×" button beside the time input clears the time and collapses back
  to the chip.
- Clearing the date clears the time too (parent `onDueDateChange("")`
  paired with `onDueTimeChange("")` — handled inside the form so both
  callers get it for free).

Both callers mirror their existing `dueDate` state with a `dueTime`
string:

- `quick-add-task-form.tsx`: new `dueTime` state, reset in `resetAll`,
  set from AI parse result, passed into `onAdd`.
- `edit-task-dialog.tsx`: initialized from
  `task.due_time` (trimmed to `HH:MM`), passed to `updateTask`.

## Server actions (`src/app/actions.ts`)

- `addTask` input gains `dueTime?: string | null`; inserts
  `due_time: input.dueTime ?? null`.
- `updateTask` input gains `dueTime: string | null`; updates `due_time`.
- Both write `null` when the date is null (mirrors the UI rule).

## Sorting

- **Today** (`today/page.tsx`): add
  `.order("due_time", { ascending: true, nullsFirst: true })` before the
  existing `created_at` ordering — untimed first, then 09:00 → 18:00.
- **Upcoming** (`upcoming/page.tsx`): same secondary order after
  `due_date`, so each day group arrives pre-sorted (the client grouping
  preserves query order).
- **Inbox** (`inbox/page.tsx`): in the same-day branch of the client
  comparator, add a `due_time` tiebreak: null first, then ascending
  string compare (`"HH:MM:SS"` compares correctly lexicographically).

## Task card display (`task-card.tsx`)

When `due_time` is set, the date badge reads `22.07 · 14:00` (existing
`CalendarDays` icon, no second clock icon — the duration chip already uses
`Clock`). Urgency styling (bold coral for due today/overdue) stays
**date-only**; time does not affect urgency in this pass.

## AI capture (`src/lib/ai/parse-task.ts`)

- JSON response schema + zod schema gain
  `due_time: string | null` (`"HH:MM"` 24-hour, null when no time
  mentioned).
- Prompt gains a line: return `due_time` as 24-hour `HH:MM` only when the
  text mentions a time of day; never invent one; `due_time` requires
  `due_date` — if a time is mentioned with no date, infer the date as
  today.
- Zod validates the shape `HH:MM` (regex) and the parse result maps it to
  `dueTime`; `runParse` in `quick-add-task-form.tsx` sets the new state
  from it (and `""` on the failure path).

## Error handling

No new failure modes — same nullable-optional pattern as `due_date`.
Soft-Ukrainian error copy unchanged. AI mis-parse falls back exactly as
today (all fields reset, including time).

## Out of scope

- Reminders / notifications at the due time.
- Time affecting urgency/overdue logic (date-only remains the rule).
- Timed tasks in Focus suggestion logic.
- Timeline/agenda visual layout on Today.

## Verification

`npx tsc --noEmit` + `npm run lint` clean; live browser pass: create a
task with date+time, date only, and neither; edit each variant including
clearing the time and clearing the date; confirm ordering on Today,
Upcoming day groups, and Inbox; one AI capture with a spoken time
("подзвонити мамі завтра о 15:30").
