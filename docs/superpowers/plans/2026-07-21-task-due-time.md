# Task Due Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a task optionally carry a time of day (`due_time`) on top of its optional `due_date`, entered manually or via AI capture, displayed on cards and used as a secondary sort key.

**Architecture:** Additive nullable `time` column beside the existing `date` column (no timestamptz merge — the whole app compares plain ISO date strings against the Europe/Kyiv day boundary). The value flows `"HH:MM"` strings end-to-end: `<input type="time">` → server action → Postgres `time`; Postgres reads back `"HH:MM:SS"`, trimmed by one helper.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + supabase-js v2), React 19 client components, zod v4, OpenRouter structured output.

## Global Constraints

- **No automated test framework exists in this repo** — do not add one. Verification for every task: `npx tsc --noEmit` (no output) and `npm run lint` (no output), plus live browser checks in the final task.
- All user-facing copy is Ukrainian, soft/pressure-free tone; no hard red.
- Existing `due_date` semantics (day-boundary matching, overdue = date-only) must not change.
- A time never exists without a date — enforced in the form UI, normalized in server actions, and backstopped by a DB check constraint.
- Commits: `git commit --no-gpg-sign`.

---

### Task 1: Migration + types + helper

**Files:**
- Create: `supabase/migrations/0004_due_time.sql`
- Modify: `src/types/gentle.ts` (DbTask interface, new helper next to `formatDuration`)

**Interfaces:**
- Produces: `DbTask.due_time: string | null` (`"HH:MM:SS"` from Supabase), `formatDueTime(time: string): string` (→ `"HH:MM"`). All later tasks consume these.

- [ ] **Step 1: Write the migration file**

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

- [ ] **Step 2: Add the field and helper to `src/types/gentle.ts`**

In `DbTask`, after `due_date: string | null;`:

```ts
  // "HH:MM:SS" from Postgres `time`, or null. Never set without due_date.
  due_time: string | null;
```

After `formatDuration`:

```ts
// Postgres `time` reads back as "HH:MM:SS"; the UI (cards and
// <input type="time">) wants "HH:MM".
export function formatDueTime(time: string): string {
  return time.slice(0, 5);
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output from tsc; lint passes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_due_time.sql src/types/gentle.ts
git commit --no-gpg-sign -m "feat: add due_time column, type, and format helper"
```

---

### Task 2: Server actions accept dueTime

**Files:**
- Modify: `src/app/actions.ts` (`addTask` ~line 80, `updateTask` ~line 131)

**Interfaces:**
- Consumes: nothing new (column from Task 1).
- Produces: `addTask` input gains `dueTime?: string | null`; `updateTask` input gains `dueTime: string | null`. Both normalize: time is written as `null` whenever the date is null.

- [ ] **Step 1: Extend `addTask`**

Input type gains `dueTime?: string | null;` after `dueDate`. The insert object changes to:

```ts
      due_date: input.dueDate ?? null,
      due_time: input.dueDate ? (input.dueTime ?? null) : null,
```

- [ ] **Step 2: Extend `updateTask`**

Input type gains `dueTime: string | null;` after `dueDate`. The update object changes to:

```ts
      due_date: input.dueDate,
      due_time: input.dueDate ? input.dueTime : null,
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (Callers pass `dueTime` starting in Task 3; `updateTask`'s new required field will surface as a tsc error in `edit-task-dialog.tsx` — if so, proceed to Task 3 and commit both together, or make `dueTime` optional-with-default here and required later. Preferred: commit Tasks 2+3 together if tsc blocks.)

- [ ] **Step 4: Commit** (jointly with Task 3 if tsc required it)

```bash
git add src/app/actions.ts
git commit --no-gpg-sign -m "feat: server actions write due_time (null without a date)"
```

---

### Task 3: Form UI — toggle-to-reveal time input + both callers

**Files:**
- Modify: `src/components/gentle/task-fields-form.tsx`
- Modify: `src/components/gentle/quick-add-task-form.tsx`
- Modify: `src/components/gentle/edit-task-dialog.tsx`
- Modify: `src/components/gentle/add-task-dialog.tsx` (`handleAdd` input type)

**Interfaces:**
- Consumes: `formatDueTime` from Task 1, `dueTime` params from Task 2.
- Produces: `TaskFieldsFormProps` gains `dueTime: string` (`""` = none, else `"HH:MM"`) and `onDueTimeChange: (value: string) => void`. `QuickAddTaskFormProps.onAdd` input gains `dueTime: string | null`.

- [ ] **Step 1: Add the time control to `task-fields-form.tsx`**

Add `useState` and `Clock`/`X` imports:

```tsx
import { useState } from "react";
import { CalendarDays, Clock, X } from "lucide-react";
```

Add props `dueTime: string;` and `onDueTimeChange: (value: string) => void;` to `TaskFieldsFormProps` and destructure them.

Inside the component, before `return`:

```tsx
  // Time input starts revealed only when the task already has a time.
  const [isTimeExpanded, setIsTimeExpanded] = useState(dueTime !== "");
```

Change the date `<input type="date">`'s `onChange` so clearing the date clears the time:

```tsx
              onChange={(e) => {
                onDueDateChange(e.target.value);
                if (!e.target.value) {
                  onDueTimeChange("");
                  setIsTimeExpanded(false);
                }
              }}
```

After the closing `</div>` of the project+date row (after line ~174), add:

```tsx
      {dueDate !== "" && (
        <div className="flex items-center justify-end">
          {isTimeExpanded ? (
            <div className="flex items-center gap-1">
              <div className="relative">
                <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft" />
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => onDueTimeChange(e.target.value)}
                  aria-label="Час виконання"
                  className="h-9 w-[120px] rounded-md border border-line bg-transparent py-2 pl-8 pr-2 text-sm text-ink-soft"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  onDueTimeChange("");
                  setIsTimeExpanded(false);
                }}
                aria-label="Прибрати час"
                className="flex size-7 items-center justify-center rounded-full text-ink-soft hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsTimeExpanded(true)}
              className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-bold text-ink-soft transition-colors hover:border-sea"
            >
              + час
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 2: Wire `quick-add-task-form.tsx`**

- State, after `dueDate`: `const [dueTime, setDueTime] = useState("");`
- `onAdd` prop input type gains `dueTime: string | null;`
- `runParse` success branch, after `setDueDate(...)`: `setDueTime(result.dueTime ?? "");` — **note:** `result.dueTime` exists only after Task 5; until then use `setDueTime("");` with a `// set from AI parse in Task 5` placement, or do Tasks 3 then 5 and wire this line in Task 5. Preferred: set `setDueTime("")` in both branches now; Task 5 upgrades the success branch.
- `runParse` failure branch: `setDueTime("");`
- `resetAll`: `setDueTime("");`
- `handleSubmit`'s `onAdd({...})` gains `dueTime: dueTime || null,`
- `<TaskFieldsForm ... dueTime={dueTime} onDueTimeChange={setDueTime} ... />`

- [ ] **Step 3: Wire `edit-task-dialog.tsx`**

- Import `formatDueTime` from `@/types/gentle`.
- State after `dueDate`: `const [dueTime, setDueTime] = useState(task?.due_time ? formatDueTime(task.due_time) : "");` (component is keyed by task id at call sites, so this initializer re-runs per task).
- `updateTask` call gains `dueTime: dueTime || null,`
- `<TaskFieldsForm ... dueTime={dueTime} onDueTimeChange={setDueTime} ... />`

- [ ] **Step 4: Wire `add-task-dialog.tsx`**

`handleAdd`'s input type gains `dueTime: string | null;` (passed through to `addTask` unchanged).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/gentle/task-fields-form.tsx src/components/gentle/quick-add-task-form.tsx src/components/gentle/edit-task-dialog.tsx src/components/gentle/add-task-dialog.tsx
git commit --no-gpg-sign -m "feat: optional time-of-day input behind a '+ час' toggle in the task form"
```

---

### Task 4: Sorting + card display

**Files:**
- Modify: `src/app/(app)/today/page.tsx` (query order)
- Modify: `src/app/(app)/upcoming/page.tsx` (query order)
- Modify: `src/app/(app)/inbox/page.tsx` (client comparator)
- Modify: `src/components/gentle/task-card.tsx` (badge)

**Interfaces:**
- Consumes: `due_time` column, `formatDueTime`.
- Produces: nothing consumed later.

- [ ] **Step 1: Today query — untimed first, then ascending time**

```ts
    .eq("due_date", today)
    .order("due_time", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });
```

- [ ] **Step 2: Upcoming query — same secondary key per day**

```ts
    .neq("status", "completed")
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: true });
```

- [ ] **Step 3: Inbox comparator — same-day time tiebreak**

In `inbox/page.tsx`, after the existing `due_date` comparison inside the sort:

```ts
    if (a.due_date !== null && b.due_date !== null && a.due_date !== b.due_date) {
      return a.due_date < b.due_date ? -1 : 1;
    }
    if (a.due_time !== b.due_time) {
      if (a.due_time === null) return -1;
      if (b.due_time === null) return 1;
      return a.due_time < b.due_time ? -1 : 1;
    }
    return 0;
```

- [ ] **Step 4: Card badge `22.07 · 14:00`**

In `task-card.tsx`, import `formatDueTime` alongside the other gentle imports, and extend the due-date span's content:

```tsx
              <CalendarDays className="size-3.5" />
              {formatDueDate(task.due_date)}
              {task.due_time ? ` · ${formatDueTime(task.due_time)}` : null}
```

Urgency (`isDueUrgent`) stays untouched — date-only.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/today/page.tsx" "src/app/(app)/upcoming/page.tsx" "src/app/(app)/inbox/page.tsx" src/components/gentle/task-card.tsx
git commit --no-gpg-sign -m "feat: sort by due_time within a day and show it on task cards"
```

---

### Task 5: AI capture extracts due_time

**Files:**
- Modify: `src/lib/ai/parse-task.ts`
- Modify: `src/components/gentle/quick-add-task-form.tsx` (one line in `runParse`)

**Interfaces:**
- Consumes: Task 3's `dueTime` state.
- Produces: `ParsedTask.dueTime: string | null` (`"HH:MM"`), populated by OpenRouter.

- [ ] **Step 1: Extend schemas + prompt in `parse-task.ts`**

zod schema gains (after `due_date`):

```ts
  due_time: z.string().nullable(),
```

`ParsedTask` gains `dueTime: string | null;`.

`RESPONSE_JSON_SCHEMA` properties gain:

```ts
        due_time: {
          type: ["string", "null"],
          description: "24-hour HH:MM, or null if no time of day was mentioned",
        },
```

…and `"due_time"` joins the `required` array.

Prompt (`buildSystemPrompt`) gains two lines after the `due_date` line:

```ts
    "- due_time: час доби у 24-годинному форматі HH:MM ('о 15:00' → '15:00'), або null якщо час не згадано. Ніколи не вигадуй час.",
    "- Якщо згадано час, але не дату — постав due_date на сьогодні.",
```

The `required` list sentence changes from «усі шість полів» to «усі сім полів».

- [ ] **Step 2: Normalize + backstop in the result mapping**

Before the final `return` in `parseTaskWithOpenRouter`:

```ts
    const rawTime = result.data.due_time;
    const dueTime =
      rawTime && /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime) ? rawTime.slice(0, 5) : null;
```

And in the returned object:

```ts
      dueDate: result.data.due_date ?? (dueTime ? todayIso : null),
      dueTime,
```

(A malformed time degrades to `null` rather than failing the whole parse; a time without a date gets today's date, mirroring the prompt rule in code.)

- [ ] **Step 3: Wire the success branch in `quick-add-task-form.tsx`**

Replace the Task-3 placeholder in `runParse`'s success branch:

```ts
      setDueTime(result.dueTime ?? "");
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/parse-task.ts src/components/gentle/quick-add-task-form.tsx
git commit --no-gpg-sign -m "feat: AI capture parses spoken/typed time into due_time"
```

---

### Task 6: Apply migration + live verification

**Files:** none (operational).

- [ ] **Step 1: Check whether 0004 is already applied**

Run a service-role probe (scratchpad script) selecting `due_time` from `tasks` limit 1 via `createAdminClient`-style client using `.env.local` keys. Error mentioning the column → not applied.

- [ ] **Step 2: If not applied — user runs the migration**

**Manual user step:** paste `supabase/migrations/0004_due_time.sql` into the Supabase SQL editor and run it. Code written in Tasks 2–5 will fail inserts/updates against the live DB until this runs.

- [ ] **Step 3: Browser verification (dev server via preview tools)**

- Create a task with date + time (chip → input), one with date only, one with neither.
- Today: untimed tasks first, timed ascending; card shows `DD.MM · HH:MM`.
- Upcoming: within a day group, untimed first then timed ascending.
- Edit: open the timed task (input pre-revealed with value), clear via ×, save; re-add a time; clear the date and confirm time clears with it.
- AI capture: «подзвонити мамі завтра о 15:30» → review step shows tomorrow's date + 15:30.

- [ ] **Step 4: Final checks**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. Then push if the working tree is fully committed.
