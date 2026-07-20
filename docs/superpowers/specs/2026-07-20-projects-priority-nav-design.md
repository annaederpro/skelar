# Projects/Priority schema + bottom nav + FAB (sub-project 2 of Todoist UI upgrade)

## Context

Second of four sub-projects in the Todoist-style UI upgrade (see
[2026-07-20-auth-and-real-supabase-design.md](2026-07-20-auth-and-real-supabase-design.md)
for sub-project 1, already shipped: auth + real Supabase data). Per the
user's "allow all, do not ask" instruction, this spec is self-authored —
every decision that would normally be a clarifying question is made below
and documented as an explicit assumption instead of asked.

Scope (from the original decomposition the user approved): DB schema for
Projects + Priority, and the navigation shell — bottom nav with 4 tabs
(Inbox/Today/Upcoming/Browse) + a floating action button (FAB) for task
creation. **Explicitly out of scope:** the visual redesign of the task
card itself (priority dot, project tag, due-date tag) — that is
sub-project 3. In this sub-project, `TaskCard` stays visually unchanged;
priority/project/due-date are captured in the schema and the add-task
form, but not yet rendered on the card.

## Decisions (self-authored, no user confirmation sought)

1. **Today/Upcoming require a due date.** The original request didn't
   mention a `due_date` column, but "Today" and "Upcoming" tabs are
   meaningless without one. Adding `tasks.due_date` (nullable `date`) is
   treated as required infrastructure for the explicitly requested nav,
   not scope creep.
2. **Inbox = `project_id IS NULL`.** No separate "is inbox" flag — matches
   the literal wording "task belongs to a project or Inbox."
3. **Default route is `/inbox`**, not `/today`, per the original request's
   explicit "Inbox (default view)." `/` redirects to `/inbox`.
4. **Priority colors are the pastel Todoist palette** already agreed
   during sub-project 1's planning: P1 rose, P2 orange/amber, P3 sky-blue,
   P4 muted grey (no color) — soft tones, never alert-red. Since the card
   itself isn't redesigned this sub-project, these tokens are defined in
   `src/types/gentle.ts` now (for sub-project 3 to consume) but only
   exercised visually in the new priority-picker control in the add-task
   form.
5. **One task-creation entry point.** The FAB + a modal (shadcn `Dialog`)
   replaces the old inline "always visible at the bottom of the list"
   `QuickAddTaskForm` placement from sub-project 1. Matches real Todoist
   mobile UX (no permanent inline composer) and avoids maintaining two
   creation UIs. The form component itself (`QuickAddTaskForm`) is
   extended in place, not duplicated.
6. **Resource status (Виснажена/В нормі/Повна сил) and the depleted
   banner are cross-cutting, not tied to one tab.** They move into the
   shared `(app)` layout header and apply to every view that lists tasks
   (Inbox/Today/Upcoming/a project's page), not just one screen. This
   preserves the core "Gentle Productivity" burnout-protection concept
   across the new multi-tab navigation instead of accidentally confining
   it to a single tab.
7. **Browse is a projects list + minimal create form**, not a full filter
   builder. Todoist's saved-filter system is explicitly out of scope —
   "filters" in the original request is satisfied by: see all projects
   with task counts, create a new project (name only, no color/icon
   picker), tap into a project to see its tasks (reusing the existing
   `TaskList`/`TaskCard` unchanged). Rename/delete project UI is deferred
   — YAGNI until a real need surfaces.
8. **FAB always defaults to Inbox** (no project preselected) regardless of
   which tab it's opened from, including from inside a project's page.
   Keeps the dialog's logic identical everywhere; the user picks a
   project from the form's selector if they want one. Revisit only if
   this proves annoying in practice.
9. **"Today" tab count badge** shown on the nav item is the count of
   non-completed tasks with `due_date = today` — recomputed on each
   server render (no realtime subscription; matches the rest of the app's
   no-revalidate, reload-to-refresh model from sub-project 1).
10. **Upcoming = `due_date > today`** (strictly after), since Today
    already owns "due today." Tasks with `due_date IS NULL` appear in
    neither Today nor Upcoming — only in Inbox/Browse — consistent with
    "Upcoming (scheduled tasks)" in the original request (unscheduled
    tasks aren't "upcoming").
11. **Resource status lives in a shared React Context (`ResourceStatusProvider`),
    not per-page state.** The layout (Server Component) fetches the
    initial value once and seeds a client `AppShell`, which provides it
    to both the header toggle and every page's task-filtering logic
    (`useResourceStatus()`), so toggling in the header instantly affects
    whichever tab is open — no separate per-page copy to keep in sync.
12. **Two components are the sanctioned exceptions to "no server refetch."**
    `AddTaskDialog` (opened from the FAB, which lives in the shared layout
    — structurally outside the per-tab task list it mutates) and
    `CreateProjectForm` (rendered on `/browse` alongside a server-rendered
    project list it has no client-state path into) both call
    `router.refresh()` after a successful mutation, which re-runs the
    current route's Server Component fetch (App Router's built-in
    mechanism for this, distinct from the Server Action–level
    `revalidatePath` the sub-project 1 constraint ruled out) so the new
    task/project appears without a full page navigation. Toggling
    completion and resource status remain purely optimistic client-state
    updates, unchanged from sub-project 1, since both stay within a
    single component's tree and don't cross a layout/page or
    server/client sibling boundary.

## Database changes (migration `0002_projects_priority.sql`)

```sql
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.tasks
  add column project_id uuid references public.projects(id) on delete set null,
  add column priority smallint not null default 4 check (priority between 1 and 4),
  add column due_date date;

create index tasks_project_id_idx on public.tasks(project_id);
create index tasks_due_date_idx on public.tasks(due_date);
create index tasks_priority_idx on public.tasks(priority);

alter table public.projects enable row level security;

create policy "Users can view own projects" on public.projects
  for select using (auth.uid() = user_id);
create policy "Users can insert own projects" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);
create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = user_id);
```

`project_id` uses `on delete set null` so deleting a project (not built in
this sub-project's UI, but the FK behavior should be correct regardless)
demotes its tasks back to Inbox instead of deleting them.

This is a **manual step for the user** to run in the Supabase SQL Editor
(the controller has no direct Postgres/DDL execution access — only the
REST/Auth APIs) — same constraint as sub-project 1's migration.

## Architecture

### Route structure

```
src/app/
  (app)/
    layout.tsx        — shared shell: resource status header, BottomNav, FAB+dialog
    inbox/page.tsx     — tasks where project_id IS NULL
    today/page.tsx     — tasks where due_date = today
    upcoming/page.tsx  — tasks where due_date > today
    browse/
      page.tsx         — project list + create-project form
      [projectId]/page.tsx — tasks for one project
  login/               — unchanged from sub-project 1
  page.tsx             — becomes a redirect to /inbox
```

`src/app/page.tsx` and `src/components/gentle/task-dashboard.tsx` from
sub-project 1 are retired: `page.tsx` becomes a one-line redirect, and
`task-dashboard.tsx`'s logic is generalized into a new
`src/components/gentle/task-view.tsx` client component reused by all four
list-rendering routes.

### Components

- **`src/components/gentle/bottom-nav.tsx`** — client component, `usePathname()`
  for active-tab highlighting. 4 links: Inbox, Today (with count badge),
  Upcoming, Browse. Sticky to viewport bottom.
- **`src/components/gentle/fab.tsx`** — client component, fixed
  bottom-right circular pastel-red button, opens `AddTaskDialog`.
- **`src/components/gentle/add-task-dialog.tsx`** — wraps the existing
  (extended) `QuickAddTaskForm` in a shadcn `Dialog`, owns open/close
  state, calls the `addTask` Server Action (extended in this sub-project
  to accept `projectId`, `priority`, `dueDate`) and closes on success.
- **`src/components/gentle/quick-add-task-form.tsx`** (modified, not
  recreated) — adds a project `<select>` (Inbox + each project by name),
  a 4-button priority picker (same interaction pattern as the existing
  energy picker), and a native `<input type="date">` for due date. All
  three are optional; omitting due date means `null`, omitting project
  means Inbox.
- **`src/context/resource-status-context.tsx`** (new) — `ResourceStatusProvider`
  (client) seeded with the layout's server-fetched initial value; owns the
  optimistic update + rollback logic sub-project 1 built for
  `updateResourceStatus`, exposed via a `useResourceStatus()` hook
  (`{ resourceStatus, setResourceStatus, isDepleted }`).
- **`src/components/gentle/app-shell.tsx`** (new) — client component
  rendered by the layout; wraps `children` in `ResourceStatusProvider`,
  renders the header (title, logout button, `ResourceStatusToggle`,
  `DepletedBanner` when depleted — all reading from `useResourceStatus()`),
  then `{children}`, then `BottomNav` and `Fab`.
- **`src/components/gentle/task-view.tsx`** (new, generalizes
  `task-dashboard.tsx`) — receives `initialTasks` and `emptyMessage`
  only; reads `isDepleted` from `useResourceStatus()` for filtering (no
  longer owns resource-status state itself) and owns
  `handleToggleComplete` (optimistic, unchanged from sub-project 1).
  Does not render its own add-task form inline anymore — creation
  happens via the FAB, which lives in `AppShell`, not per-page.
- **`src/app/(app)/browse/page.tsx`** — Server Component: fetches
  projects with a task count per project (`select *, tasks(count)`),
  renders a simple list + a small inline "new project" form (client
  component `src/components/gentle/project-list.tsx`) that calls a new
  `createProject` Server Action.

### Server Actions (append to `src/app/actions.ts`)

- `createProject(name: string): Promise<{ project: DbProject } | { error: string }>`
- `addTask` (modified signature): now takes
  `{ title, energyLevel, durationMinutes, projectId, priority, dueDate }`
  where `projectId: string | null`, `priority: Priority`,
  `dueDate: string | null` (ISO date or null). Existing callers must be
  updated for the new required fields (defaults: `projectId: null`,
  `priority: 4`, `dueDate: null` when the form leaves them unset).

### Types (`src/types/gentle.ts` additions)

```ts
export type Priority = 1 | 2 | 3 | 4;

export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

// DbTask gains: project_id: string | null; priority: Priority; due_date: string | null;

export const PRIORITY_LABEL: Record<Priority, string> = {
  1: "P1", 2: "P2", 3: "P3", 4: "P4",
};
export const PRIORITY_DOT_CLASS: Record<Priority, string> = {
  1: "bg-rose-400", 2: "bg-orange-400", 3: "bg-sky-400", 4: "bg-muted-foreground/40",
};
```

## Error handling

Same conventions as sub-project 1: Server Actions return
`{ error: string }` with soft Ukrainian copy, never throw to the client;
`createProject` rejects an empty/whitespace-only name client-side before
submitting (same pattern as the existing title validation in
`QuickAddTaskForm`).

## Out of scope

- Task card visual redesign (priority dot, project tag, due-date tag on
  the card itself) — sub-project 3.
- Voice capture — sub-project 4.
- Project rename/delete UI, saved filters, drag-to-reorder, project
  colors/icons.
- Realtime updates / Server Action–level `revalidatePath` — Decision 12
  above covers the two necessary exceptions (`router.refresh()` after
  FAB-based task creation and after project creation in Browse);
  everything else stays optimistic client state, per sub-project 1's
  constraint, carried forward.

## Verification plan

1. Run migration `0002_projects_priority.sql` (manual, user).
2. Visiting `/` redirects to `/inbox`; a fresh account shows an empty
   Inbox.
3. FAB opens the dialog; creating a task with no project/priority/date set
   defaults to Inbox/P4/no due date and appears in Inbox.
4. Creating a task with a due date of today appears in Today, with the
   Today nav badge count incrementing; a task due tomorrow appears in
   Upcoming, not Today.
5. Creating a new project in Browse, then creating a task assigned to it
   via the FAB dialog, shows the task under that project's page
   (`/browse/[projectId]`) and not in Inbox.
6. Toggling resource status to "Виснажена" hides any `energy_level = 3`
   task consistently across Inbox/Today/Upcoming/a project page
   (cross-cutting per Decision 6), regardless of that task's priority.
7. Reload (`F5`) on any tab preserves all of the above (real DB, no
   client-only state).
