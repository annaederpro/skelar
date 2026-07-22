# Всі задачі — importance sort + "Виконані" filter — design spec

## Context

The "Всі задачі" tab (`/inbox`, `src/app/(app)/inbox/page.tsx`) is the only
place a user sees every active task at once. Today it's ordered purely by
due date — a "no due date, then due today, then everything else" bucket,
computed client-side in `inbox/page.tsx` (`dueDateBucket`) — with no regard
for `priority`, and completed tasks stay interleaved wherever their due
date happens to place them.

This spec reorders that tab so importance drives the primary grouping
(matching the app's existing "Важливо / Звичайне / Колись" priority
vocabulary — `PRIORITY_BUCKET_LABEL` in `src/types/gentle.ts`), with
completed tasks always falling to the bottom, and adds a top filter chip
to isolate completed tasks on demand.

`TaskView` (`src/components/gentle/task-view.tsx`) is shared by `/inbox`,
`/today`, and `/browse/[projectId]`. Per the user, this change is
**"Всі задачі" only** — `/today` (which already excludes completed tasks
at the query level) and `/browse/[projectId]` keep their current ordering
and gain no new filter UI.

## Decisions locked with the user before writing this spec

- **Primary grouping**: the existing 3-bucket priority grouping (Важливо /
  Звичайне / Колись, via `priorityBucket()`) drives sort order — not the
  raw 1–4 `priority` value.
- **Secondary sort (within a group)**: nearest due date first; tasks with
  no due date sort to the end of their group.
- **Completed tasks**: always sort after all active groups, in the default
  "Усі" view.
- **Filter chip**: "Виконані" is an *isolating* filter (show only
  completed tasks), not a show/hide toggle — same as `ProjectFilterBar`'s
  existing chip-select pattern, not a checkbox.
- **Completed-only order**: when isolated via "Виконані", completed tasks
  are sorted with the *same* comparator (priority bucket → due date) —
  there's no `completed_at` column, and the user explicitly chose not to
  add one for this pass rather than sort by recency.
- **Scope**: `/inbox` only. `/today` and `/browse/[projectId]` are
  untouched — no new prop threading into those pages, gated instead by
  `pathname === "/inbox"` inside `TaskView`, matching the existing
  pathname-gated pattern already used there for the today-only "depleted"
  energy filter (`task-view.tsx:36`).

## Non-goals (this pass)

- No section headers or visual dividers between priority groups or before
  the completed group. The ask is correct ordering, not a new grouped
  layout — `TaskCard` already shows a priority pill and a distinct
  completed style, so position alone should read clearly.
- No DB migration. `priority` and `status` already carry everything this
  sort needs.
- No `completed_at` timestamp column (see "Completed-only order" above).
- No change to `/today` or `/browse/[projectId]` ordering or filter UI.
- No change to the existing `ProjectFilterBar` / project filtering — the
  new status filter is an independent, additional row.

## Sort logic

New pure function in `src/types/gentle.ts`, next to `priorityBucket()`:

```ts
const PRIORITY_BUCKET_RANK: Record<PriorityBucket, number> = { high: 0, mid: 1, low: 2 };

export function compareTasksForAllTasksTab(a: DbTask, b: DbTask): number {
  const statusDiff = Number(a.status === "completed") - Number(b.status === "completed");
  if (statusDiff !== 0) return statusDiff;

  const bucketDiff =
    PRIORITY_BUCKET_RANK[priorityBucket(a.priority)] - PRIORITY_BUCKET_RANK[priorityBucket(b.priority)];
  if (bucketDiff !== 0) return bucketDiff;

  if (a.due_date !== b.due_date) {
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }

  if (a.due_time !== b.due_time) {
    if (a.due_time === null) return 1;
    if (b.due_time === null) return -1;
    return a.due_time < b.due_time ? -1 : 1;
  }

  return 0; // stable sort keeps existing relative (created_at desc) order
}
```

One comparator serves both filter states:
- **"Усі"**: applied to the full list — active tasks (Важливо → Звичайне →
  Колись, nearest due date first within each) then completed tasks
  (same internal ordering) at the bottom.
- **"Виконані"**: the list is filtered to `status === "completed"` first,
  then the same comparator applied — the status-group key becomes a
  no-op tiebreaker, so completed tasks still land Важливо → Звичайне →
  Колись, nearest due date first.

`inbox/page.tsx`'s current `dueDateBucket` sort (lines 8-13, 30-42) is
deleted — it's superseded by `TaskView` owning final ordering. The page
fetch simplifies back to a plain `.order("created_at", { ascending: false })`,
since `TaskView` re-sorts the full list anyway.

## Filter UI

New component `TaskStatusFilterBar`, `src/components/gentle/task-status-filter-bar.tsx`:

```ts
export type StatusFilter = "all" | "completed";

interface TaskStatusFilterBarProps {
  statusFilter: StatusFilter;
  onSelectFilter: (filter: StatusFilter) => void;
}
```

- Renders two chips — **Усі** / **Виконані** — visually matching
  `ProjectFilterBar`'s `chipClass` pill styling (same active/inactive
  classes, same `aria-pressed` pattern) for consistency, but as its own
  component: reusing the literal word "Усі" inside `ProjectFilterBar`
  itself would conflate "all projects" with "all statuses" in one row.
- No long-press menu, no create-new affordance — just two static chips.
- `role="group" aria-label="Фільтр за статусом"`, matching
  `ProjectFilterBar`'s `aria-label="Фільтр за проєктом"` convention.

## `TaskView` changes

`src/components/gentle/task-view.tsx`:

- New state: `const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")`.
- New pathname check: `const isAllTasksTab = pathname === "/inbox"` (same
  style as the existing `applyDepletedFilter` line 36).
- `visibleTasks` `useMemo` (lines 51-65) gains, only when `isAllTasksTab`:
  - a filter step: if `statusFilter === "completed"`, keep only
    `status === "completed"` tasks;
  - a final `.sort(compareTasksForAllTasksTab)` before returning.
  - When `!isAllTasksTab`, behavior is byte-for-byte unchanged from today.
- Render: `<TaskStatusFilterBar .../>` above `<ProjectFilterBar .../>`
  (line ~130), only when `isAllTasksTab`.
- Empty-state message when `statusFilter === "completed"` and the
  filtered list is empty: a short line in the app's existing empty-state
  voice, e.g. *"Ще немає виконаних задач 🌿"* — passed into `TaskList`'s
  `emptyMessage` the same way the existing project-filter empty message
  is conditionally chosen (lines 152-156).

## Error handling

No new server calls or mutations are introduced — sorting and filtering
are pure client-side derivations of already-fetched data, so there's no
new failure mode beyond what `TaskView` already handles (task
completion/release network errors, unchanged by this spec).

## Testing

No test runner in this repo (existing project convention — manual
verification):

1. On "Всі задачі" with a mix of priorities, due dates, and some completed
   tasks: confirm order is Важливо (nearest due date first, undated last)
   → Звичайне → Колись → completed tasks (same internal ordering).
2. Toggle "Виконані": list narrows to only completed tasks, still ordered
   Важливо → Звичайне → Колись by due date within each.
3. Toggle back to "Усі": full list returns, same order as step 1.
4. Combine with an existing project filter chip: confirm both filters
   apply together (status filter + project filter narrow the same list).
5. Complete a task from "Усі": it should move to the bottom of the list
   without a full page reload glitch (optimistic state update already
   exists in `handleToggleComplete`; this spec doesn't change that flow,
   only final ordering).
6. Visit "/today" and a project page under "/browse": confirm no status
   filter chip appears and task order is unchanged from current
   behavior (plain `created_at desc`, as today — neither page ever had
   the due-date-bucket sort `/inbox` used).

## Self-authored decisions (assumptions — user may veto at spec review)

- `compareTasksForAllTasksTab` lives in `src/types/gentle.ts` rather than
  a new file, matching where `priorityBucket()` and the other
  priority/formatting pure functions already live.
- The empty-state copy for the "Виконані" filter with zero completed
  tasks is a new string I'm proposing in-voice, not one the user
  specified — flagged here for a quick sanity check rather than a full
  question round.
