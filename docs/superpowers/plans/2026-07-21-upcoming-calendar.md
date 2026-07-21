# Upcoming week-strip calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Todoist-style week strip (with busy-day dots and tap-to-jump) to coralQ's `/upcoming` tab, plus an Overdue section — currently completely missing from the app.

**Architecture:** A new `UpcomingView` client component replaces `TaskView` on the Upcoming route. It renders a `WeekStrip` (new, self-contained date-navigation component) above an Overdue bucket and a sparse day-grouped task list, both derived client-side from one broadened Supabase query (`due_date` not null, not completed). A `ProjectFilterBar` is extracted out of the existing `TaskView` so both views share it without duplicating ~50 lines of JSX.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions — already established in this codebase, no new APIs introduced), React 19, Tailwind v4 with the existing coralQ ocean design tokens, Supabase (`@supabase/ssr`). No test framework exists in this repo (`package.json` has no jest/vitest/tsx) — verification follows this project's established convention: `npx tsc --noEmit` + `npm run lint` clean after every task, plus live browser verification via the preview tools.

## Global Constraints

- Ukrainian UI copy throughout (matching every existing coralQ string) — no English or Russian strings in new UI.
- Ocean palette tokens only (`--sea`, `--sea-deep`, `--sea-soft`, `--coral`, `--coral-soft`, `--ink`, `--ink-soft`, `--line`, `--paper`, `--card`) — no ad hoc colors, no true red (per coralQ's "no hard red" rule).
- No DB schema changes — everything derives from the existing `tasks.due_date` / `tasks.status` columns.
- `Today` and `Inbox` tabs must render identically before and after this work (the only shared file touched, `task-view.tsx`, changes via pure refactor in Task 1).
- Month-grid calendar view and swipe gestures are explicitly out of scope (see [[2026-07-21-upcoming-calendar-design]]).
- Per user's standing preference: commits use `--no-gpg-sign` (pinentry cannot prompt in this environment).

---

### Task 1: Extract `ProjectFilterBar` out of `TaskView`

**Files:**
- Create: `src/components/gentle/project-filter-bar.tsx`
- Modify: `src/components/gentle/task-view.tsx`

**Interfaces:**
- Produces: `ProjectFilterBar` component and exported type `ProjectFilter = "all" | "none" | string`, both from `src/components/gentle/project-filter-bar.tsx`. Props:
  ```ts
  interface ProjectFilterBarProps {
    projects: { id: string; name: string }[];
    projectFilter: ProjectFilter;
    onSelectFilter: (filter: ProjectFilter) => void;
    isCreatingProject: boolean;
    onToggleCreating: () => void;
    newProjectName: string;
    onNewProjectNameChange: (value: string) => void;
    onCreateProject: (e: React.FormEvent) => void;
  }
  ```
- Consumes (in `task-view.tsx`): existing local state (`projectFilter`, `isCreatingProject`, `newProjectName`) and `useProjects()` — no new state introduced, just passed down as props instead of used inline in JSX.

This is a pure refactor: no visual or behavioral change. It exists so Task 2's `UpcomingView` can reuse the filter bar instead of duplicating it.

- [ ] **Step 1: Create the extracted component**

Write `src/components/gentle/project-filter-bar.tsx`:

```tsx
"use client";

import { Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// "all" shows everything, "none" shows tasks without a project, otherwise a project id.
export type ProjectFilter = "all" | "none" | string;

interface ProjectFilterBarProps {
  projects: { id: string; name: string }[];
  projectFilter: ProjectFilter;
  onSelectFilter: (filter: ProjectFilter) => void;
  isCreatingProject: boolean;
  onToggleCreating: () => void;
  newProjectName: string;
  onNewProjectNameChange: (value: string) => void;
  onCreateProject: (e: React.FormEvent) => void;
}

const chipClass = (isActive: boolean) =>
  cn(
    "shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-[7px] text-[12.5px] font-bold transition-colors",
    isActive
      ? "border-sea bg-sea-soft text-sea-deep"
      : "border-line bg-card text-ink-soft hover:text-ink",
  );

export function ProjectFilterBar({
  projects,
  projectFilter,
  onSelectFilter,
  isCreatingProject,
  onToggleCreating,
  newProjectName,
  onNewProjectNameChange,
  onCreateProject,
}: ProjectFilterBarProps) {
  return (
    <>
      <div
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Фільтр за проєктом"
      >
        {projects.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => onSelectFilter("all")}
              aria-pressed={projectFilter === "all"}
              className={chipClass(projectFilter === "all")}
            >
              Усі
            </button>
            <button
              type="button"
              onClick={() => onSelectFilter("none")}
              aria-pressed={projectFilter === "none"}
              className={chipClass(projectFilter === "none")}
            >
              Без проєкту
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectFilter(project.id)}
                aria-pressed={projectFilter === project.id}
                className={chipClass(projectFilter === project.id)}
              >
                {project.name}
              </button>
            ))}
          </>
        )}
        <button
          type="button"
          onClick={onToggleCreating}
          aria-expanded={isCreatingProject}
          className={cn(chipClass(false), "flex items-center gap-1")}
        >
          <Plus className="size-3.5" />
          {projects.length === 0 && "Проєкт"}
        </button>
      </div>

      {isCreatingProject && (
        <form onSubmit={onCreateProject} className="flex items-center gap-2">
          <input
            value={newProjectName}
            onChange={(e) => onNewProjectNameChange(e.target.value)}
            placeholder="Назва нового проєкту"
            autoFocus
            aria-label="Назва нового проєкту"
            className="h-9 min-w-0 flex-1 rounded-full border border-line bg-card px-4 text-sm"
          />
          <button
            type="submit"
            aria-label="Створити проєкт"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sea text-white transition-colors hover:bg-sea-deep"
          >
            <Check className="size-4" />
          </button>
        </form>
      )}
    </>
  );
}
```

- [ ] **Step 2: Wire it into `task-view.tsx`**

In `src/components/gentle/task-view.tsx`:

1. Replace the import line `import { Plus, Check } from "lucide-react";` with:
   ```ts
   import { ProjectFilterBar, type ProjectFilter } from "@/components/gentle/project-filter-bar";
   ```
2. Delete the local `type ProjectFilter = "all" | "none" | string;` declaration (line ~20) — now imported instead.
3. Delete the local `chipClass` function (lines ~99–105) — it moved into `ProjectFilterBar`.
4. Replace the JSX block that currently spans from `<div className="-mx-1 flex gap-2 ..." role="group" ...>` through the closing of the `{isCreatingProject && (...)}` form block (lines ~109–174 in the original file) with:
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

Everything else in `task-view.tsx` (state declarations, `handleToggleComplete`, `handleCreateProject`, the error message paragraph, `TaskList`) stays exactly as-is.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors (confirms `Plus`/`Check`/`chipClass` aren't flagged as unused anywhere, and no new unused imports were left behind).

- [ ] **Step 4: Browser-verify no regression**

Using the preview tools: start the dev server, sign in, open `/today` (or `/inbox`) and confirm:
- The project filter chip row still renders and still filters the task list when a chip is clicked.
- The "+ Проєкт" chip still opens the inline create-project form, and creating a project still works and selects it as the active filter.

- [ ] **Step 5: Commit**

```bash
git add src/components/gentle/project-filter-bar.tsx src/components/gentle/task-view.tsx
git commit --no-gpg-sign -m "refactor: extract ProjectFilterBar out of TaskView"
```

---

### Task 2: Date-formatting helpers + `WeekStrip` component, wired into `/upcoming`

**Files:**
- Create: `src/lib/upcoming-date.ts`
- Create: `src/components/gentle/week-strip.tsx`
- Create: `src/components/gentle/upcoming-view.tsx`
- Modify: `src/app/(app)/upcoming/page.tsx`

**Interfaces:**
- Produces (from `src/lib/upcoming-date.ts`, used by both this task and Task 3):
  ```ts
  export function addDays(isoDate: string, days: number): string;
  export function mondayIndex(isoDate: string): number; // 0=Mon..6=Sun
  export function getWeekStart(isoDate: string): string;
  export function getWeekDates(weekStart: string): string[]; // 7 ISO dates
  export function formatMonthLabel(isoDate: string): string; // "Липень 2026"
  export function formatDayHeader(isoDate: string, today: string): string; // "22 лип · Завтра" / "23 лип · четвер"
  export const WEEKDAY_SHORT: string[]; // ["Пн","Вт","Ср","Чт","Пт","Сб","Нд"], Monday-indexed
  ```
- Produces `WeekStrip` component, props:
  ```ts
  interface WeekStripProps {
    today: string; // ISO date, e.g. from getAppToday()
    busyDates: Set<string>; // ISO dates with >=1 undone task
    onSelectDate: (date: string) => void;
  }
  ```
- Produces `UpcomingView` component, props: `{ initialTasks: DbTask[]; emptyMessage?: string }` (same shape as `TaskView`, so `upcoming/page.tsx` swaps one for the other with no other change).
- Consumes: `getAppToday` from `@/lib/date`, `toggleTaskComplete`/`createProject` from `@/app/actions`, `useProjects` from `@/context/projects-context`, `ProjectFilterBar`/`ProjectFilter` from Task 1, `TaskList` from `@/components/gentle/task-list`.

At the end of this task, `/upcoming` still shows one flat task list (query unchanged) but with the week strip above it, fully interactive for navigation (week paging, "today" reset) and partially interactive for tap-to-jump (the `today` case works immediately via a ref; the past/future-date cases reference DOM ids that don't exist until Task 3 adds them, so they safely no-op — same code, no rewrite needed next task).

- [ ] **Step 1: Write the date-formatting helpers**

Create `src/lib/upcoming-date.ts`:

```ts
const MONTH_ABBR = [
  "січ", "лют", "бер", "кві", "тра", "чер",
  "лип", "сер", "вер", "жов", "лис", "гру",
];
const MONTH_FULL = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
];
// Monday-indexed (0 = Monday .. 6 = Sunday)
export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const WEEKDAY_FULL = [
  "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота", "неділя",
];

// "2026-07-22" + 1 → "2026-07-23". UTC-based so the local machine's DST
// never shifts the calendar date the string represents.
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 0 (Monday) .. 6 (Sunday), converted from JS's native 0=Sunday.
export function mondayIndex(isoDate: string): number {
  const jsDay = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function getWeekStart(isoDate: string): string {
  return addDays(isoDate, -mondayIndex(isoDate));
}

export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatMonthLabel(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${MONTH_FULL[Number(month) - 1]} ${year}`;
}

// "2026-07-22" → "22 лип · Завтра" (or "23 лип · четвер" for any other day)
export function formatDayHeader(isoDate: string, today: string): string {
  const [, month, day] = isoDate.split("-");
  const relative =
    isoDate === addDays(today, 1) ? "Завтра" : WEEKDAY_FULL[mondayIndex(isoDate)];
  return `${Number(day)} ${MONTH_ABBR[Number(month) - 1]} · ${relative}`;
}
```

- [ ] **Step 2: Write the `WeekStrip` component**

Create `src/components/gentle/week-strip.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  formatMonthLabel,
  getWeekDates,
  getWeekStart,
  mondayIndex,
  WEEKDAY_SHORT,
} from "@/lib/upcoming-date";
import { cn } from "@/lib/utils";

interface WeekStripProps {
  today: string;
  busyDates: Set<string>;
  onSelectDate: (date: string) => void;
}

export function WeekStrip({ today, busyDates, onSelectDate }: WeekStripProps) {
  const currentWeekStart = getWeekStart(today);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const weekDates = getWeekDates(weekStart);
  const isCurrentWeek = weekStart === currentWeekStart;

  return (
    <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between px-1">
        <span className="font-heading text-[15px] font-medium text-ink">
          {formatMonthLabel(weekStart)}
        </span>
        <div className="flex items-center gap-1">
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setWeekStart(currentWeekStart)}
              className="mr-1 text-[12.5px] font-bold text-sea-deep"
            >
              Сьогодні
            </button>
          )}
          <button
            type="button"
            aria-label="Попередній тиждень"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="flex size-7 items-center justify-center rounded-full text-ink-soft hover:bg-paper"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Наступний тиждень"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="flex size-7 items-center justify-center rounded-full text-ink-soft hover:bg-paper"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((date) => {
          const isToday = date === today;
          const isBusy = busyDates.has(date);
          const dayNum = Number(date.slice(-2));
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className="flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors hover:bg-paper"
            >
              <span className="text-[11px] font-bold uppercase text-ink-soft">
                {WEEKDAY_SHORT[mondayIndex(date)]}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-[13.5px] font-bold",
                  isToday ? "bg-coral text-white" : "text-ink",
                )}
              >
                {dayNum}
              </span>
              <span
                className={cn("size-[5px] rounded-full", isBusy ? "bg-sea" : "bg-transparent")}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `UpcomingView`**

Create `src/components/gentle/upcoming-view.tsx`:

```tsx
"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskList } from "@/components/gentle/task-list";
import { WeekStrip } from "@/components/gentle/week-strip";
import { ProjectFilterBar, type ProjectFilter } from "@/components/gentle/project-filter-bar";
import { toggleTaskComplete, createProject } from "@/app/actions";
import { useProjects } from "@/context/projects-context";
import { getAppToday } from "@/lib/date";
import type { DbTask } from "@/types/gentle";

interface UpcomingViewProps {
  initialTasks: DbTask[];
  emptyMessage?: string;
}

export function UpcomingView({ initialTasks, emptyMessage }: UpcomingViewProps) {
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [syncedTasks, setSyncedTasks] = useState(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>("all");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [, startTransition] = useTransition();
  const projects = useProjects();
  const router = useRouter();
  const today = getAppToday();
  const listTopRef = useRef<HTMLDivElement>(null);

  if (initialTasks !== syncedTasks) {
    setSyncedTasks(initialTasks);
    setTasks(initialTasks);
  }

  const projectNameById = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  );

  const visibleTasks = useMemo(() => {
    if (projectFilter === "none") return tasks.filter((t) => t.project_id === null);
    if (projectFilter !== "all") return tasks.filter((t) => t.project_id === projectFilter);
    return tasks;
  }, [tasks, projectFilter]);

  const busyDates = useMemo(() => {
    const set = new Set<string>();
    for (const task of visibleTasks) {
      if (task.status !== "completed" && task.due_date) set.add(task.due_date);
    }
    return set;
  }, [visibleTasks]);

  const handleSelectDate = (date: string) => {
    if (date < today) {
      document.getElementById("overdue-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (date === today) {
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      document.getElementById(`day-${date}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleToggleComplete = (task: DbTask) => {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await toggleTaskComplete(task.id, nextStatus);
      if ("error" in result) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed) return;
    setErrorMessage(null);
    const result = await createProject(trimmed);
    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }
    setNewProjectName("");
    setIsCreatingProject(false);
    setProjectFilter(result.project.id);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-2">
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
      <WeekStrip today={today} busyDates={busyDates} onSelectDate={handleSelectDate} />
      {errorMessage && (
        <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-sm text-coral">
          {errorMessage}
        </p>
      )}
      <div ref={listTopRef} />
      <TaskList
        tasks={visibleTasks}
        projectNameById={projectNameById}
        onToggleComplete={handleToggleComplete}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
```

- [ ] **Step 4: Wire it into the route**

Modify `src/app/(app)/upcoming/page.tsx` — replace the `TaskView` import and usage with `UpcomingView` (query stays as `gt("due_date", today)` for now, broadened in Task 3):

```tsx
import { createClient } from "@/lib/supabase/server";
import { getAppToday } from "@/lib/date";
import { UpcomingView } from "@/components/gentle/upcoming-view";
import type { DbTask } from "@/types/gentle";

export default async function UpcomingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const today = getAppToday();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .gt("due_date", today)
    .order("due_date", { ascending: true });

  return (
    <UpcomingView initialTasks={(tasks ?? []) as DbTask[]} emptyMessage="Немає запланованих задач 🌿" />
  );
}
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 6: Browser-verify**

Using the preview tools: start the dev server, sign in, open `/upcoming` and confirm:
- The week strip renders 7 day pills labeled Пн–Нд, today's pill filled coral, month/year label above (e.g. "Липень 2026").
- Clicking the right/left chevrons pages the strip a week forward/back and the month label updates; a "Сьогодні" link appears once paged away and returns to the current week when clicked.
- If any existing task has a future `due_date`, its date shows a dot under the corresponding pill.
- Clicking today's pill doesn't throw a console error (check `preview_console_logs`); clicking a future date pill also doesn't throw (it's a safe no-op until Task 3).
- The flat task list below still renders exactly as before, and the project filter chips still work.

- [ ] **Step 7: Commit**

```bash
git add src/lib/upcoming-date.ts src/components/gentle/week-strip.tsx src/components/gentle/upcoming-view.tsx "src/app/(app)/upcoming/page.tsx"
git commit --no-gpg-sign -m "feat: add week-strip calendar to Upcoming tab"
```

---

### Task 3: Broaden the query, add the Overdue section and sparse day-grouping

**Files:**
- Modify: `src/app/(app)/upcoming/page.tsx`
- Modify: `src/components/gentle/upcoming-view.tsx`

**Interfaces:**
- Consumes: `formatDayHeader` from `src/lib/upcoming-date.ts` (Task 2). No new exports — this task only changes what data flows into the already-built `UpcomingView` and how it renders that data.

This task makes the `handleSelectDate` logic written in Task 2 fully functional (no changes needed to that function) by giving it real `overdue-section` and `day-${date}` DOM anchors to find, and fixes the app-wide gap where overdue tasks appear nowhere.

- [ ] **Step 1: Broaden the Supabase query**

Modify `src/app/(app)/upcoming/page.tsx` to fetch all dated, non-completed tasks (past, today, and future) instead of only future ones:

```tsx
import { createClient } from "@/lib/supabase/server";
import { UpcomingView } from "@/components/gentle/upcoming-view";
import type { DbTask } from "@/types/gentle";

export default async function UpcomingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .not("due_date", "is", null)
    .neq("status", "completed")
    .order("due_date", { ascending: true });

  return (
    <UpcomingView initialTasks={(tasks ?? []) as DbTask[]} emptyMessage="Немає запланованих задач 🌿" />
  );
}
```

(The `getAppToday` import is no longer needed in this file — it moved to being used only inside `upcoming-view.tsx`.)

- [ ] **Step 2: Split and group tasks in `UpcomingView`**

In `src/components/gentle/upcoming-view.tsx`:

1. Add the import: `import { formatDayHeader } from "@/lib/upcoming-date";`
2. After the existing `busyDates` `useMemo` block, add:
   ```ts
   const overdueTasks = useMemo(
     () => visibleTasks.filter((t) => t.due_date !== null && t.due_date < today),
     [visibleTasks, today],
   );

   const groupedUpcoming = useMemo(() => {
     const map = new Map<string, DbTask[]>();
     for (const task of visibleTasks) {
       if (task.due_date === null || task.due_date <= today) continue;
       const group = map.get(task.due_date) ?? [];
       group.push(task);
       map.set(task.due_date, group);
     }
     return map; // insertion order matches ascending due_date since visibleTasks is pre-sorted by the query
   }, [visibleTasks, today]);
   ```
3. Replace the final `<TaskList ... />` render (the one right after `<div ref={listTopRef} />`) with:
   ```tsx
   {overdueTasks.length === 0 && groupedUpcoming.size === 0 ? (
     <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
       {emptyMessage}
     </p>
   ) : (
     <>
       {overdueTasks.length > 0 && (
         <section id="overdue-section" className="flex flex-col gap-2">
           <h2 className="px-1 text-[13px] font-bold text-coral">Прострочено</h2>
           <TaskList
             tasks={overdueTasks}
             projectNameById={projectNameById}
             onToggleComplete={handleToggleComplete}
           />
         </section>
       )}
       <div ref={listTopRef} />
       {Array.from(groupedUpcoming.entries()).map(([date, dayTasks]) => (
         <section key={date} id={`day-${date}`} className="flex flex-col gap-2">
           <h2 className="px-1 text-[13px] font-bold text-ink-soft">
             {formatDayHeader(date, today)}
           </h2>
           <TaskList
             tasks={dayTasks}
             projectNameById={projectNameById}
             onToggleComplete={handleToggleComplete}
           />
         </section>
       ))}
     </>
   )}
   ```
   Note `<div ref={listTopRef} />` moves here (between the Overdue section and the first day section) — remove it from its old spot directly under the error-message block.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Browser-verify end-to-end**

Using the preview tools: start the dev server, sign in, on `/upcoming`:
1. Use the "+" add-task flow to create three test tasks: one with a due date of yesterday, one due tomorrow, one due in 3 days.
2. Confirm a "Прострочено" section appears at the top containing the yesterday task.
3. Confirm the tomorrow and +3-day tasks each appear under their own date header (e.g. "· Завтра" and the correct weekday name for the +3-day one).
4. Confirm the week strip shows dots under yesterday's, today's-non-existent-but-any-busy, tomorrow's, and the +3-day pill (if within the visible week) — page forward with the chevron if the +3-day date falls outside the current week's 7 pills, and confirm its dot appears there.
5. Click the tomorrow pill and confirm the view scrolls to the tomorrow section; click a past-week pill (e.g. yesterday, after paging back if needed) and confirm it scrolls to the Overdue section.
6. Confirm completing a task (checking it off) still works from within these grouped sections and the task disappears from its group.
7. Check `preview_console_logs` for errors and `preview_network` for failed requests.
8. Take a `preview_screenshot` of the final state as visual confirmation.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/upcoming/page.tsx" src/components/gentle/upcoming-view.tsx
git commit --no-gpg-sign -m "feat: add Overdue section and day-grouped list to Upcoming"
```
