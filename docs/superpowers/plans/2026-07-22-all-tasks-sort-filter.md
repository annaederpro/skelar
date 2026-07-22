# Всі задачі — importance sort + Виконані filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the "Всі задачі" tab (`/inbox`) so importance drives sort order (Важливо → Звичайне → Колись, nearest due date first within each group, completed tasks always last), and add a top "Усі" / "Виконані" filter chip that isolates completed tasks.

**Architecture:** A single pure comparator function (`compareTasksForAllTasksTab`) in `src/types/gentle.ts` drives both the default ordering and the isolated "Виконані" view — one sort, reused. A new two-chip filter bar (`TaskStatusFilterBar`) sits above the existing `ProjectFilterBar`. Both are wired into `TaskView`'s existing `visibleTasks` memo, gated to `pathname === "/inbox"` so `/today` and `/browse/[projectId]` (which also render `TaskView`) are untouched. `inbox/page.tsx` drops its now-redundant client-side due-date sort since `TaskView` owns final ordering.

**Tech Stack:** Next.js 16 (Server Components + Client Components), Supabase (`supabase-js`), Tailwind v4, no new npm dependencies.

## Global Constraints

- Scope is `/inbox` ("Всі задачі") **only**. `/today` and `/browse/[projectId]` — which also render `TaskView` — must show byte-for-byte unchanged behavior: no status filter chip, no re-sort.
- No new npm dependency.
- No DB migration — `priority` and `status` already carry everything this sort needs.
- No section headers/dividers between priority groups or before the completed group — ordering only.
- Filter chip labels, exact strings: **"Усі"** / **"Виконані"**.
- "Виконані" is an *isolating* filter (show only completed), not a show/hide toggle.
- Completed tasks, in both the default view and the isolated "Виконані" view, are still internally ordered Важливо → Звичайне → Колись → nearest due date first — same comparator, not a separate "recency" sort (no `completed_at` column exists or is being added).
- This repo has no automated test runner (confirmed: no `jest`/`vitest`/`pytest` in `package.json`). Verification below is `npx tsc --noEmit`, `npx eslint`, and manual interaction via the `preview_*` tools plus deterministic seed data inserted directly through the Supabase SQL editor — matching the precedent in `docs/superpowers/plans/2026-07-22-task-release.md`.
- Commits use `--no-gpg-sign` (pinentry cannot prompt in this environment).

---

## Task 1: Sort comparator in `src/types/gentle.ts`

**Files:**
- Modify: `src/types/gentle.ts` (append after line 130, the end of the file)

**Interfaces:**
- Produces: `compareTasksForAllTasksTab(a: DbTask, b: DbTask): number` — a `Array.prototype.sort` comparator. Every later task that sorts the "Всі задачі" list imports this by name.

- [ ] **Step 1: Append the comparator**

The file currently ends with:

```ts
// left card accent bar
export const PRIORITY_BUCKET_BAR_CLASS: Record<PriorityBucket, string> = {
  high: "bg-coral",
  mid: "bg-transparent",
  low: "bg-transparent",
};
```

Append after it:

```ts

// ── "Всі задачі" sort: importance first, then due date, completed last ──
// One comparator serves both the default view (active tasks grouped
// Важливо → Звичайне → Колись, completed tasks last, same internal
// grouping) and the isolated "Виконані" filter (list pre-filtered to
// status === "completed", so the status key below becomes a no-op
// tiebreaker and completed tasks still sort Важливо → Звичайне → Колись).
const PRIORITY_BUCKET_RANK: Record<PriorityBucket, number> = { high: 0, mid: 1, low: 2 };

export function compareTasksForAllTasksTab(a: DbTask, b: DbTask): number {
  const statusDiff = Number(a.status === "completed") - Number(b.status === "completed");
  if (statusDiff !== 0) return statusDiff;

  const bucketDiff =
    PRIORITY_BUCKET_RANK[priorityBucket(a.priority)] - PRIORITY_BUCKET_RANK[priorityBucket(b.priority)];
  if (bucketDiff !== 0) return bucketDiff;

  // Nearest due date first; no due date sorts to the end of the group.
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

  return 0; // stable sort preserves existing relative (fetch) order
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/types/gentle.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/gentle.ts
git commit --no-gpg-sign -m "feat: add compareTasksForAllTasksTab sort comparator"
```

---

## Task 2: `TaskStatusFilterBar` component

**Files:**
- Modify: `src/components/gentle/project-filter-bar.tsx:30` (export the existing `chipClass` helper for reuse)
- Create: `src/components/gentle/task-status-filter-bar.tsx`

**Interfaces:**
- Consumes: `chipClass(isActive: boolean): string` from `project-filter-bar.tsx`.
- Produces: `TaskStatusFilterBar({ statusFilter: StatusFilter; onSelectFilter: (filter: StatusFilter) => void })` and the exported type `StatusFilter = "all" | "completed"`. Task 3 imports both.

- [ ] **Step 1: Export `chipClass`**

In `src/components/gentle/project-filter-bar.tsx`, replace:

```ts
const chipClass = (isActive: boolean) =>
```

with:

```ts
export const chipClass = (isActive: boolean) =>
```

- [ ] **Step 2: Create `task-status-filter-bar.tsx`**

```tsx
"use client";

import { chipClass } from "@/components/gentle/project-filter-bar";

export type StatusFilter = "all" | "completed";

interface TaskStatusFilterBarProps {
  statusFilter: StatusFilter;
  onSelectFilter: (filter: StatusFilter) => void;
}

export function TaskStatusFilterBar({ statusFilter, onSelectFilter }: TaskStatusFilterBarProps) {
  return (
    <div
      className="-mx-1 flex items-center gap-2 px-1"
      role="group"
      aria-label="Фільтр за статусом"
    >
      <button
        type="button"
        onClick={() => onSelectFilter("all")}
        aria-pressed={statusFilter === "all"}
        className={chipClass(statusFilter === "all")}
      >
        Усі
      </button>
      <button
        type="button"
        onClick={() => onSelectFilter("completed")}
        aria-pressed={statusFilter === "completed"}
        className={chipClass(statusFilter === "completed")}
      >
        Виконані
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/project-filter-bar.tsx src/components/gentle/task-status-filter-bar.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/gentle/project-filter-bar.tsx src/components/gentle/task-status-filter-bar.tsx
git commit --no-gpg-sign -m "feat: add TaskStatusFilterBar component"
```

---

## Task 3: Wire sort + filter into `TaskView`

**Files:**
- Modify: `src/components/gentle/task-view.tsx`

**Interfaces:**
- Consumes: `compareTasksForAllTasksTab` (Task 1), `TaskStatusFilterBar` + `StatusFilter` (Task 2).

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { ProjectFilterBar, type ProjectFilter } from "@/components/gentle/project-filter-bar";
```

with:

```tsx
import { ProjectFilterBar, type ProjectFilter } from "@/components/gentle/project-filter-bar";
import { TaskStatusFilterBar, type StatusFilter } from "@/components/gentle/task-status-filter-bar";
```

Replace:

```tsx
import { priorityBucket } from "@/types/gentle";
```

with:

```tsx
import { priorityBucket, compareTasksForAllTasksTab } from "@/types/gentle";
```

- [ ] **Step 2: Add `statusFilter` state and the `/inbox` gate**

Replace:

```tsx
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
```

with:

```tsx
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
```

Replace:

```tsx
  // The energy-based filter (hide deep-effort tasks) applies only on Сьогодні —
  // other tabs show everything regardless of today's energy level.
  const applyDepletedFilter = isDepleted && (pathname === "/today" || pathname.startsWith("/today/"));
```

with:

```tsx
  // The energy-based filter (hide deep-effort tasks) applies only on Сьогодні —
  // other tabs show everything regardless of today's energy level.
  const applyDepletedFilter = isDepleted && (pathname === "/today" || pathname.startsWith("/today/"));
  // Importance sort + Виконані filter apply only on "Всі задачі" — /today
  // already excludes completed tasks at the query level, and /browse's
  // project pages keep their existing created_at order.
  const isAllTasksTab = pathname === "/inbox";
```

- [ ] **Step 3: Fold the filter + sort into `visibleTasks`**

Replace:

```tsx
  const visibleTasks = useMemo(() => {
    // Depleted days hide deep-effort tasks — but never important ones:
    // a "Важливо" task stays visible regardless of how heavy it is.
    let list = applyDepletedFilter
      ? tasks.filter(
          (task) => task.energy_level < 3 || priorityBucket(task.priority) === "high",
        )
      : tasks;
    if (projectFilter === "none") {
      list = list.filter((task) => task.project_id === null);
    } else if (projectFilter !== "all") {
      list = list.filter((task) => task.project_id === projectFilter);
    }
    return list;
  }, [tasks, applyDepletedFilter, projectFilter]);
```

with:

```tsx
  const visibleTasks = useMemo(() => {
    // Depleted days hide deep-effort tasks — but never important ones:
    // a "Важливо" task stays visible regardless of how heavy it is.
    let list = applyDepletedFilter
      ? tasks.filter(
          (task) => task.energy_level < 3 || priorityBucket(task.priority) === "high",
        )
      : tasks;
    if (projectFilter === "none") {
      list = list.filter((task) => task.project_id === null);
    } else if (projectFilter !== "all") {
      list = list.filter((task) => task.project_id === projectFilter);
    }
    if (isAllTasksTab) {
      if (statusFilter === "completed") {
        list = list.filter((task) => task.status === "completed");
      }
      // .slice() first: list may still be the same array reference as
      // `tasks` (no depleted/project filter applied) — sorting in place
      // would mutate component state.
      list = list.slice().sort(compareTasksForAllTasksTab);
    }
    return list;
  }, [tasks, applyDepletedFilter, projectFilter, isAllTasksTab, statusFilter]);
```

- [ ] **Step 4: Render the status filter bar and update the empty-state message**

Replace:

```tsx
      <ProjectFilterBar
        projects={projects}
        projectFilter={projectFilter}
        onSelectFilter={setProjectFilter}
        isCreatingProject={isCreatingProject}
        onToggleCreating={() => setIsCreatingProject((v) => !v)}
        newProjectName={newProjectName}
        onNewProjectNameChange={setNewProjectName}
        onCreateProject={handleCreateProject}
      />
```

with:

```tsx
      {isAllTasksTab && (
        <TaskStatusFilterBar statusFilter={statusFilter} onSelectFilter={setStatusFilter} />
      )}
      <ProjectFilterBar
        projects={projects}
        projectFilter={projectFilter}
        onSelectFilter={setProjectFilter}
        isCreatingProject={isCreatingProject}
        onToggleCreating={() => setIsCreatingProject((v) => !v)}
        newProjectName={newProjectName}
        onNewProjectNameChange={setNewProjectName}
        onCreateProject={handleCreateProject}
      />
```

Replace:

```tsx
        emptyMessage={
          projectFilter !== "all" && tasks.length > 0
            ? "У цьому проєкті поки порожньо 🌊"
            : emptyMessage
        }
```

with:

```tsx
        emptyMessage={
          isAllTasksTab && statusFilter === "completed"
            ? "Ще немає виконаних задач 🌿"
            : projectFilter !== "all" && tasks.length > 0
              ? "У цьому проєкті поки порожньо 🌊"
              : emptyMessage
        }
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/task-view.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/gentle/task-view.tsx
git commit --no-gpg-sign -m "feat: sort Всі задачі by importance and add Виконані filter"
```

---

## Task 4: Simplify `inbox/page.tsx`

**Files:**
- Modify: `src/app/(app)/inbox/page.tsx`

**Interfaces:**
- Consumes: nothing new — `TaskView` (Task 3) now owns final ordering for this route.

- [ ] **Step 1: Drop the redundant client-side due-date sort**

Replace the full file:

```tsx
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAppToday } from "@/lib/date";
import { TaskView } from "@/components/gentle/task-view";
import type { DbTask } from "@/types/gentle";

// No due date first, then due today, then everything else in calendar order.
function dueDateBucket(task: DbTask, today: string): 0 | 1 | 2 {
  if (task.due_date === null) return 0;
  if (task.due_date === today) return 1;
  return 2;
}

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .is("released_at", null)
    .order("created_at", { ascending: false });

  const today = getAppToday();
  const sortedTasks = (tasks ?? []).slice().sort((a, b) => {
    const bucketDiff = dueDateBucket(a, today) - dueDateBucket(b, today);
    if (bucketDiff !== 0) return bucketDiff;
    if (a.due_date !== null && b.due_date !== null && a.due_date !== b.due_date) {
      return a.due_date < b.due_date ? -1 : 1;
    }
    if (a.due_time !== b.due_time) {
      if (a.due_time === null) return -1;
      if (b.due_time === null) return 1;
      return a.due_time < b.due_time ? -1 : 1;
    }
    return 0;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Всі задачі</h2>
        <Link
          href="/trash"
          className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:bg-muted/70"
        >
          <Trash2 className="size-3.5" />
          Кошик
        </Link>
      </div>
      <TaskView initialTasks={sortedTasks as DbTask[]} emptyMessage="Всі задачі порожні. Гарний знак 🌿" />
    </div>
  );
}
```

with:

```tsx
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TaskView } from "@/components/gentle/task-view";
import type { DbTask } from "@/types/gentle";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .is("released_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold">Всі задачі</h2>
        <Link
          href="/trash"
          className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:bg-muted/70"
        >
          <Trash2 className="size-3.5" />
          Кошик
        </Link>
      </div>
      <TaskView initialTasks={(tasks ?? []) as DbTask[]} emptyMessage="Всі задачі порожні. Гарний знак 🌿" />
    </div>
  );
}
```

`TaskView` now fully re-sorts this list (Task 3), so the fetch order here
no longer matters beyond giving `TaskView` a stable initial array.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "src/app/(app)/inbox/page.tsx"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/inbox/page.tsx"
git commit --no-gpg-sign -m "refactor: drop redundant due-date sort from inbox page"
```

---

## Task 5: End-to-end verification

**Files:** none (verification only, plus optional cleanup of seed data).

- [ ] **Step 1: Full typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint`
Expected: no errors across the whole project.

- [ ] **Step 2: Seed deterministic test tasks**

⚠️ Manual action required. Open the Supabase dashboard's SQL Editor for
this project and run:

```sql
insert into public.tasks (user_id, title, status, energy_level, duration_minutes, priority, due_date)
values
  ((select id from auth.users order by created_at limit 1), 'ZZZ Т1 важливо без дати', 'todo', 1, 30, 1, null),
  ((select id from auth.users order by created_at limit 1), 'ZZZ Т2 важливо з датою', 'todo', 1, 30, 1, current_date + 2),
  ((select id from auth.users order by created_at limit 1), 'ZZZ Т3 звичайне з датою', 'todo', 1, 30, 2, current_date + 1),
  ((select id from auth.users order by created_at limit 1), 'ZZZ Т4 колись', 'todo', 1, 30, 4, null),
  ((select id from auth.users order by created_at limit 1), 'ZZZ Т5 виконано важливе', 'completed', 1, 30, 1, null);
```

This assumes a single dev user in `auth.users`; if there are multiple,
replace the subquery with an explicit `where email = '<your dev email>'`
filter instead.

Expected ordering under the sort rules from Task 1: **Т2 → Т1 → Т3 → Т4 →
Т5** (Важливо group by nearest due date, undated last; then Звичайне; then
Колись; then the one completed task last).

- [ ] **Step 3: Start the dev server and load "Всі задачі"**

Use `preview_start` (per this project's tooling: `next dev` is
single-instance per directory — if it fails with "Another next dev server
is already running," check whether that's a different active session
before killing it). Navigate to `/inbox`.

- [ ] **Step 4: Confirm the filter bar renders**

`preview_snapshot`. Expected: two chips reading "Усі" (pressed/active) and
"Виконані" (not pressed), positioned above the existing project filter
chips ("Усі" for projects, "Без проєкту", etc.).

- [ ] **Step 5: Confirm default sort order**

`preview_snapshot` the task list. Expected: among the five `ZZZ`-prefixed
tasks, they appear in this exact order: **ZZZ Т2 → ZZZ Т1 → ZZZ Т3 → ZZZ
Т4 → ZZZ Т5**.

- [ ] **Step 6: Confirm the "Виконані" filter isolates**

`preview_click` the "Виконані" chip. `preview_snapshot`. Expected: only
**ZZZ Т5** (the completed task) is visible among the `ZZZ`-prefixed tasks;
`aria-pressed` on the "Виконані" chip is now `true` and `false` on "Усі".

- [ ] **Step 7: Confirm returning to "Усі" restores full order**

`preview_click` the "Усі" chip. `preview_snapshot`. Expected: same order
as Step 5 (ZZZ Т2 → ZZZ Т1 → ZZZ Т3 → ZZZ Т4 → ZZZ Т5).

- [ ] **Step 8: Confirm the status filter combines with the project filter**

Still on "Усі" (status), `preview_click` the "Без проєкту" project chip
(all five `ZZZ` seed tasks have no project, so they should all remain
visible in the same order as Step 5). Then `preview_click` "Виконані" —
expected: only **ZZZ Т5** remains, i.e. both filters narrow the same list
together. `preview_click` "Усі" (project) then "Усі" (status) to reset
before continuing.

- [ ] **Step 9: Confirm completing a task re-sorts it to the bottom**

`preview_click` the checkbox on **ZZZ Т1** (currently in the Важливо
group, active). `preview_snapshot`. Expected: it disappears from its
Важливо position and reappears at the very end of the `ZZZ`-prefixed
tasks (after ZZZ Т5, since both are now completed and ZZZ Т1's `priority`
is 1/Важливо same as ZZZ Т5 — tie-break falls to due date, both null, then
stable order). No full-page reload glitch — this reuses `TaskView`'s
existing optimistic `handleToggleComplete`, unchanged by this plan.
Click the checkbox again to restore ZZZ Т1 to `todo` before continuing.

- [ ] **Step 10: Confirm `/today` and a project page are unaffected**

Navigate to `/today`. `preview_snapshot`. Expected: no "Усі"/"Виконані"
filter chips present (only whatever `/today` normally renders). Repeat for
any existing `/browse/[projectId]` page reachable from the UI — same
expectation, no new chip row.

- [ ] **Step 11: Clean up seed data**

⚠️ Manual action required. In the Supabase SQL Editor:

```sql
delete from public.tasks where title like 'ZZZ %';
```

Confirm zero rows remain: `select count(*) from public.tasks where title like 'ZZZ %';` → expect `0`.

This task has no commit of its own (verification only).
