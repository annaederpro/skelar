# Upcoming calendar (week strip) — design spec

## Context

coralQ's `/upcoming` tab (`src/app/(app)/upcoming/page.tsx`) currently renders a
flat, chronologically-sorted list of tasks with `due_date > today` via the
shared `TaskView`/`TaskList` components — no date grouping, no calendar UI,
and no visibility into overdue tasks anywhere in the app.

The user wants a Todoist-style calendar added to this tab: a one-week strip
with busy-day dots, tapping a day jumps the list to that day's tasks. A
Things 3 screenshot was shared as visual reference, but only for the general
shape — the user confirmed scope should track the explicit request (week
strip + dots + jump-on-tap), not everything visible in that screenshot.

This is additive to the existing coralQ redesign
([[2026-07-21-coralq-redesign-design]]) and touches only the Upcoming tab.

## Decisions locked with the user

- Week strip shows exactly 7 days at a time (not a month grid).
- Days with ≥1 undone task get a dot indicator.
- Tapping a day scrolls the list to that day's section.
- The list below is **not** capped to the visible week — it's Todoist-style:
  every day that has a task gets a section, indefinitely into the future,
  and the strip is a quick-jump shortcut into that longer list (confirmed:
  "same as in todoist and screenshot", i.e. option "all upcoming tasks").
- Month-grid calendar toggle: **out of scope**, not requested.
- Swipe-to-page-weeks: **out of scope for v1** — chevron buttons instead,
  to avoid touch-gesture-threshold complexity and conflicts with page
  scroll. Easy to add later if chevrons feel clunky on device.

## Data layer

Replace the current query in `upcoming/page.tsx`:

```ts
.gt("due_date", today)
```

with a single broader query:

```ts
const { data: tasks } = await supabase
  .from("tasks")
  .select("*")
  .eq("user_id", userId)
  .not("due_date", "is", null)
  .neq("status", "completed")
  .order("due_date", { ascending: true });
```

This one fetch covers three needs at once: overdue detection (`due_date <
today`), the strip's busy-day dots (any date in view, past or future), and
the day-grouped future list (`due_date > today`). All three are derived
client-side from this one array using `getAppToday()` — no extra Supabase
round trips.

## Component architecture

**New file `src/components/gentle/week-strip.tsx`** (`"use client"`):
- Props: `tasksByDate: Map<string, DbTask[]>` (or similar lookup), `onSelectDate: (date: string) => void`.
- Internal state: `weekStart` (ISO date, Monday of the displayed week), initialized to the Monday of the week containing `getAppToday()`.
- Renders month/year label (Ukrainian, e.g. "Липень 2026") with `<` `>` chevrons that shift `weekStart` by ±7 days, plus a "Сьогодні" text link that resets `weekStart` to the current week (shown only when paged away from it).
- Renders 7 day-pills (Пн–Нд). Today's pill gets a filled coral circle. Each pill shows a dot underneath if `tasksByDate` has an entry for that date. Tapping a pill calls `onSelectDate(date)`.

**New file `src/components/gentle/project-filter-bar.tsx`** (`"use client"`):
- Extracted from the existing project-filter-chip JSX block in `TaskView`
  (lines ~107–154 of `task-view.tsx`) — the "Усі" / "Без проєкту" / per-project
  chips + inline "new project" form. Takes the same state/handlers as props.
  `TaskView` is updated to use it (no behavior change there); the new
  Upcoming view uses it too. This is the one refactor bundled into this
  change — it directly serves reuse between the two views, nothing beyond
  that.

**New file `src/components/gentle/upcoming-view.tsx`** (`"use client"`):
- Replaces `TaskView` as what `upcoming/page.tsx` renders.
- Takes `initialTasks: DbTask[]` (the broadened query result above).
- Splits tasks into `overdue` (`due_date < today`) and `upcoming` (`due_date > today`), both already sorted from the query. Tasks with `due_date === today` are excluded from both lists (today has its own tab; only used for the strip's dot data).
- Groups `upcoming` into `Map<date, DbTask[]>` for sparse day sections — only dates present in the map render a header; no filler for empty days.
- Renders, top to bottom: `ProjectFilterBar` → `WeekStrip` → Overdue section (if non-empty: heading "Прострочено" + `TaskList`) → one `<section id={`day-${date}`}>` per grouped date with a header (e.g. "22 лип · Завтра · середа") + `TaskList`.
- Reuses existing `toggleTaskComplete` handler pattern and `useResourceStatus`/`useProjects` contexts exactly as `TaskView` does today (copy that wiring, don't invent new state shape).
- Applies the project filter across both the overdue bucket and all day sections (same filter state, filters the underlying task list before grouping).
- Empty state: if both `overdue` and `upcoming` are empty, show the existing `emptyMessage` ("Немає запланованих задач 🌿") below the strip (strip itself always renders regardless of task count).

**Date header formatting:** new small helper (in `upcoming-view.tsx` or `lib/date.ts`) mapping an ISO date to `"22 лип · Завтра · середа"`-style Ukrainian text: day number + abbreviated Ukrainian month, then a relative/weekday label — "Завтра" for tomorrow, otherwise the Ukrainian weekday name (Понеділок/Вівторок/.../Неділя, or abbreviated to match the pill labels).

## Interaction: tap-to-jump

`onSelectDate(date)` in `UpcomingView`:
- `date < today` → `document.getElementById("overdue-section")?.scrollIntoView({ behavior: "smooth", block: "start" })`.
- `date === today` → scroll the list container to top.
- `date > today` → `document.getElementById(`day-${date}`)?.scrollIntoView(...)`; if no such element exists (no tasks that day), no-op — the absent dot already signaled this.

## Visual styling

Follows the existing coralQ ocean palette (`--sea`, `--coral`, `--paper`,
`--line`, etc. — see [[2026-07-21-coralq-redesign-design]]). Today's pill
uses `--coral` fill (matching the reference screenshot's red emphasis
while staying on-brand, since coralQ's palette has no true red). Dots use
`--sea`. Strip card uses the same white rounded-20 / shadow-sm treatment as
other coralQ surfaces.

`TaskCard` itself is **unchanged** — it already renders a per-task due-date
chip (coral + bold when overdue). This is slightly redundant under a day
header that states the same date, but is left as-is: it's harmless, costs
nothing extra to build, and is actually useful inside the mixed-date
Overdue bucket where multiple different overdue dates sit side by side.

## Out of scope (v1)

- Month-grid calendar view / toggle button.
- Swipe gestures for week paging (chevron buttons only).
- Any change to `Today` or `Inbox` tabs.
- Any DB schema change (all derived from existing `tasks.due_date`/`status`).

## Verification approach

Same as prior coralQ work: `npx tsc --noEmit` + `npm run lint` clean, plus
live browser verification (Upcoming tab renders strip + overdue + grouped
future tasks correctly against real Supabase data; tapping strip days
scrolls to the right section; project filter still works across both
overdue and grouped sections; empty states render correctly).
