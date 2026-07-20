# Projects/Priority Schema + Bottom Nav + FAB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Projects + Priority to the schema, and replace the single-page prototype from sub-project 1 with a Todoist-style navigation shell — bottom nav (Inbox/Today/Upcoming/Browse) + a floating action button for task creation — while keeping the task card itself visually unchanged (deferred to sub-project 3).

**Architecture:** A new `(app)` route group provides a shared `layout.tsx` (Server Component) that fetches the signed-in user's profile, projects, and today's task count once, and hands them to a client `AppShell` that renders the header (resource-status toggle, cross-cutting via React Context), the routed page content, `BottomNav`, and `Fab`. Each tab (`/inbox`, `/today`, `/upcoming`, `/browse`) is its own Server Component page with its own Supabase query, rendering a shared `TaskView` client component. Task creation moves from an inline form to a FAB-triggered `Dialog`; because the FAB lives in the layout (outside the per-tab list it mutates), it calls `router.refresh()` on success — one of two sanctioned exceptions to the "no server refetch" rule from sub-project 1 (the other being project creation in Browse, same reasoning).

**Tech Stack:** Next.js 16 App Router (route groups, dynamic routes), React 19 (Context, `useTransition`), `@supabase/ssr`, Tailwind v4, shadcn/ui (`Dialog`, built on `@base-ui/react`).

## Global Constraints

- No new schema beyond what's in `supabase/migrations/0002_projects_priority.sql` (Task 1): `projects` table, `tasks.project_id`/`priority`/`due_date`.
- **Task card visual redesign is explicitly out of scope.** `TaskCard`/`TaskList` are not modified in this plan — priority/project/due-date are captured in data and in the add-task form only. That's sub-project 3.
- Inbox = `tasks.project_id IS NULL`. Today = `due_date = <today>`. Upcoming = `due_date > <today>`. Tasks with `due_date IS NULL` appear in neither Today nor Upcoming.
- Root `/` redirects to `/inbox` (Inbox is the default view, per the original request).
- Resource status (Виснажена/В нормі/Повна сил) and the depleted-task filter are cross-cutting: one `ResourceStatusProvider` (React Context) seeded once by the layout, consumed by both the header toggle and every tab's task filtering — not per-page state.
- **`router.refresh()` is used only for creation flows that cross a component boundary with no client state to splice into**, and nowhere else. Two sanctioned call sites: `AddTaskDialog` after a successful `addTask` (the FAB lives in the layout, structurally outside the per-tab list it mutates), and `CreateProjectForm` after a successful `createProject` (the project list it feeds is rendered by a sibling Server Component, `browse/page.tsx`, with no client-side list state to prepend into). Every other mutation (`toggleTaskComplete`, `updateResourceStatus`) remains a purely optimistic client-state update with rollback on error, exactly as sub-project 1 built it — do not add a third `router.refresh()`/`revalidatePath` call site without updating this constraint first.
- All user-facing copy is Ukrainian, soft/non-alarming tone (rose-tinted errors, never a hard alert box) — same convention as sub-project 1.
- Every Server Action creates its own `createClient()` and relies on RLS for authorization (no redundant manual `user_id` filters beyond what scopes an insert) — same convention as sub-project 1. `toggleTaskComplete` additionally gains a `getUser()` session-expiry guard in Task 2 (fixing a carried-over Minor finding from sub-project 1's final review — call this out in your work, it's an intentional, disclosed fix, not scope creep).
- **Backward compatibility during the transition:** Tasks 2 and 4 modify `addTask` and `QuickAddTaskForm` in ways that must NOT break the still-live sub-project-1 files (`src/app/page.tsx`, `src/components/gentle/task-dashboard.tsx`) until Task 7 retires them. Achieve this with optional parameters/props and sensible defaults (`projectId?: string | null`, `priority?: Priority = 4`, `dueDate?: string | null`, `projects: DbProject[] = []`) — never with a breaking required-field change. `npx tsc --noEmit` must pass after every single task, including the ones in between.
- No automated test framework exists in this repo. Verification per task is `npx tsc --noEmit` + `npm run lint` (both must report nothing) plus a manual/live check where the task produces observable behavior — same convention as sub-project 1. The DB migration (Task 1) is a **manual step for the user**; the controller has no direct Postgres/DDL execution access.

---

## Task 1: Database migration + shared types

**This task's SQL step is manual — the user must run it in the Supabase SQL Editor; do not delegate it to a subagent, which has no dashboard access.** The TypeScript changes can and should be implemented and verified via `tsc`/`lint` regardless of whether the migration has been run yet (this codebase has no generated DB types binding the client to the live schema, so `tsc` cannot detect a missing column — only a live query would fail until the migration runs).

**Files:**
- Create: `supabase/migrations/0002_projects_priority.sql`
- Modify: `src/types/gentle.ts` (full rewrite — currently 49 lines from Block 1/sub-project 1)

**Interfaces:**
- Produces (for every later task to import from `@/types/gentle`):
  - `export type Priority = 1 | 2 | 3 | 4;`
  - `export interface DbProject { id: string; user_id: string; name: string; created_at: string; }`
  - `DbTask` gains three fields: `project_id: string | null; priority: Priority; due_date: string | null;`
  - `export const PRIORITY_LABEL: Record<Priority, string>` and `export const PRIORITY_DOT_CLASS: Record<Priority, string>`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0002_projects_priority.sql
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

- [ ] **Step 2: Ask the user to run it** (only if you're the controller running this plan interactively — a dispatched implementer subagent should skip this step and report it as a note for the controller instead of blocking)

Tell the user: "Run `supabase/migrations/0002_projects_priority.sql` in your Supabase project's SQL Editor when ready — the rest of this task's code doesn't require it to be live yet, but later tasks' live verification will."

- [ ] **Step 3: Replace `src/types/gentle.ts` entirely**

```ts
export type ResourceStatus = "depleted" | "normal" | "high";

export type TaskStatus = "todo" | "completed";

export type EnergyLevel = 1 | 2 | 3;

export type Priority = 1 | 2 | 3 | 4;

export interface DbUser {
  id: string;
  email: string;
  current_resource_status: ResourceStatus;
  telegram_chat_id: string | null;
  created_at: string;
}

export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface DbTask {
  id: string;
  user_id: string;
  title: string;
  status: TaskStatus;
  energy_level: EnergyLevel;
  duration_minutes: number;
  is_backlog: boolean;
  created_at: string;
  project_id: string | null;
  priority: Priority;
  due_date: string | null;
}

export const ENERGY_LABEL: Record<EnergyLevel, string> = {
  1: "⚡️ Легка",
  2: "⚡️⚡️ Середня",
  3: "⚡️⚡️⚡️ Важка",
};

export const ENERGY_DOT_CLASS: Record<EnergyLevel, string> = {
  1: "bg-emerald-400",
  2: "bg-amber-400",
  3: "bg-rose-400",
};

export const ENERGY_BADGE_CLASS: Record<EnergyLevel, string> = {
  1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  2: "bg-amber-100 text-amber-700 border-amber-200",
  3: "bg-rose-100 text-rose-700 border-rose-200",
};

export const RESOURCE_STATUS_LABEL: Record<ResourceStatus, string> = {
  depleted: "Виснажена",
  normal: "В нормі",
  high: "Повна сил",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
};

export const PRIORITY_DOT_CLASS: Record<Priority, string> = {
  1: "bg-rose-400",
  2: "bg-orange-400",
  3: "bg-sky-400",
  4: "bg-muted-foreground/40",
};
```

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors. (`DbTask` gained required fields, but nothing constructs a `DbTask` object literal directly in this codebase — all task data comes from Supabase query results cast with `as DbTask` — so this is not expected to break any existing file. If it does, that's a real finding — report it, don't paper over it.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_projects_priority.sql src/types/gentle.ts
git commit --no-gpg-sign -m "feat: add projects/priority/due_date schema and types"
```

---

## Task 2: Server Actions — projects, extended addTask, session-check fix

**Files:**
- Modify: `src/app/actions.ts` (full rewrite — currently 141 lines from sub-project 1)

**Interfaces:**
- Consumes: `DbProject`, `Priority` from `@/types/gentle` (Task 1).
- Produces (for later tasks to import from `@/app/actions`):
  - `addTask` signature changes to accept optional `projectId?: string | null`, `priority?: Priority`, `dueDate?: string | null` (defaults applied inside: `null`, `4`, `null`) — existing 3-field call sites keep compiling unchanged.
  - `export async function createProject(name: string): Promise<{ project: DbProject } | { error: string }>`
  - `toggleTaskComplete` gains a `getUser()` guard (was previously missing one, unlike its sibling actions).

- [ ] **Step 1: Replace `src/app/actions.ts` entirely**

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  DbProject,
  DbTask,
  EnergyLevel,
  Priority,
  ResourceStatus,
  TaskStatus,
} from "@/types/gentle";

export type AuthFormState = {
  error: string | null;
  message: string | null;
};

function mapAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Невірний email або пароль.";
  }
  if (message.includes("User already registered")) {
    return "Користувач з таким email вже зареєстрований.";
  }
  if (message.includes("Password should be at least")) {
    return "Пароль має містити щонайменше 6 символів.";
  }
  return "Щось пішло не так, спробуй ще раз.";
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: mapAuthError(error.message), message: null };
  }

  redirect("/");
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: mapAuthError(error.message), message: null };
  }

  if (!data.session) {
    return {
      error: null,
      message: "Перевір пошту — надіслали лист для підтвердження реєстрації.",
    };
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function addTask(input: {
  title: string;
  energyLevel: EnergyLevel;
  durationMinutes: number;
  projectId?: string | null;
  priority?: Priority;
  dueDate?: string | null;
}): Promise<{ task: DbTask } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: input.title,
      energy_level: input.energyLevel,
      duration_minutes: input.durationMinutes,
      project_id: input.projectId ?? null,
      priority: input.priority ?? 4,
      due_date: input.dueDate ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return { error: "Не вдалося додати задачу, спробуй ще раз." };
  }

  return { task: data as DbTask };
}

export async function toggleTaskComplete(
  taskId: string,
  nextStatus: TaskStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", taskId);

  if (error) {
    return { error: "Не вдалося оновити задачу." };
  }

  return { ok: true };
}

export async function updateResourceStatus(
  status: ResourceStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("users")
    .update({ current_resource_status: status })
    .eq("id", user.id);

  if (error) {
    return { error: "Не вдалося зберегти стан ресурсу." };
  }

  return { ok: true };
}

export async function createProject(
  name: string,
): Promise<{ project: DbProject } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Назва проєкту не може бути порожньою." };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: trimmed })
    .select()
    .single();

  if (error || !data) {
    return { error: "Не вдалося створити проєкт, спробуй ще раз." };
  }

  return { project: data as DbProject };
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors, including in `src/components/gentle/task-dashboard.tsx` and `src/app/page.tsx` (sub-project 1 files, unmodified) — their existing 3-field `addTask` calls must still compile against the new optional-field signature.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions.ts
git commit --no-gpg-sign -m "feat: add createProject, extend addTask with project/priority/due-date, fix toggleTaskComplete session check"
```

---

## Task 3: Resource-status Context

**Files:**
- Create: `src/context/resource-status-context.tsx`

**Interfaces:**
- Consumes: `updateResourceStatus` from `@/app/actions` (existing, unchanged); `ResourceStatus` from `@/types/gentle`.
- Produces (for Task 6's `AppShell` and Task 7's `TaskView` to import):
  - `export function ResourceStatusProvider({ initialResourceStatus, children }: { initialResourceStatus: ResourceStatus; children: ReactNode }): JSX.Element`
  - `export function useResourceStatus(): { resourceStatus: ResourceStatus; setResourceStatus: (next: ResourceStatus) => void; isDepleted: boolean }`

This file is not imported anywhere yet after this task — that's expected, Task 6 wires it in. `npm run lint` does not flag unused exports (only unused local variables/imports within a file), so this is safely lintable standalone.

- [ ] **Step 1: Create `src/context/resource-status-context.tsx`**

```tsx
"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { updateResourceStatus } from "@/app/actions";
import type { ResourceStatus } from "@/types/gentle";

interface ResourceStatusContextValue {
  resourceStatus: ResourceStatus;
  setResourceStatus: (next: ResourceStatus) => void;
  isDepleted: boolean;
}

const ResourceStatusContext = createContext<ResourceStatusContextValue | null>(null);

export function ResourceStatusProvider({
  initialResourceStatus,
  children,
}: {
  initialResourceStatus: ResourceStatus;
  children: ReactNode;
}) {
  const [resourceStatus, setResourceStatusState] = useState<ResourceStatus>(initialResourceStatus);
  const [, startTransition] = useTransition();

  const setResourceStatus = (next: ResourceStatus) => {
    const previous = resourceStatus;
    setResourceStatusState(next);
    startTransition(async () => {
      const result = await updateResourceStatus(next);
      if ("error" in result) {
        setResourceStatusState(previous);
      }
    });
  };

  return (
    <ResourceStatusContext.Provider
      value={{ resourceStatus, setResourceStatus, isDepleted: resourceStatus === "depleted" }}
    >
      {children}
    </ResourceStatusContext.Provider>
  );
}

export function useResourceStatus(): ResourceStatusContextValue {
  const ctx = useContext(ResourceStatusContext);
  if (!ctx) {
    throw new Error("useResourceStatus must be used within ResourceStatusProvider");
  }
  return ctx;
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors.

- [ ] **Step 3: Commit**

```bash
git add src/context/resource-status-context.tsx
git commit --no-gpg-sign -m "feat: add cross-cutting resource-status Context"
```

---

## Task 4: Extend QuickAddTaskForm with project/priority/due-date

**Files:**
- Modify: `src/components/gentle/quick-add-task-form.tsx` (full rewrite — currently ~86 lines from sub-project 1)

**Interfaces:**
- Consumes: `DbProject`, `Priority`, `PRIORITY_DOT_CLASS`, `PRIORITY_LABEL` from `@/types/gentle` (Task 1).
- Produces (for Task 5's `AddTaskDialog` to import): `onAdd` callback now always receives `{ title, energyLevel, durationMinutes, projectId, priority, dueDate }`; new optional prop `projects: DbProject[] = []`.

The existing caller `src/components/gentle/task-dashboard.tsx` (sub-project 1) passes `onAdd={handleAddTask}` where `handleAddTask`'s parameter type only mentions `{ title, energyLevel, durationMinutes }`. This still type-checks: TypeScript checks callback parameter types contravariantly, and a function that only reads a subset of an object's fields is assignable wherever a function expecting the fuller object is expected. Do not "fix" `task-dashboard.tsx` in this task — it's retired wholesale in Task 7.

- [ ] **Step 1: Replace `src/components/gentle/quick-add-task-form.tsx` entirely**

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { DbProject, EnergyLevel, Priority } from "@/types/gentle";
import { ENERGY_DOT_CLASS, PRIORITY_DOT_CLASS, PRIORITY_LABEL } from "@/types/gentle";
import { cn } from "@/lib/utils";

interface QuickAddTaskFormProps {
  onAdd: (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
    projectId: string | null;
    priority: Priority;
    dueDate: string | null;
  }) => void;
  disabledEnergyLevels?: EnergyLevel[];
  projects?: DbProject[];
}

const ENERGY_OPTIONS: EnergyLevel[] = [1, 2, 3];
const PRIORITY_OPTIONS: Priority[] = [1, 2, 3, 4];

export function QuickAddTaskForm({
  onAdd,
  disabledEnergyLevels = [],
  projects = [],
}: QuickAddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(1);
  const [duration, setDuration] = useState(30);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>(4);
  const [dueDate, setDueDate] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;

    onAdd({
      title: trimmed,
      energyLevel,
      durationMinutes: duration,
      projectId,
      priority,
      dueDate: dueDate || null,
    });
    setTitle("");
    setEnergyLevel(1);
    setDuration(30);
    setProjectId(null);
    setPriority(4);
    setDueDate("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border bg-card p-3">
      <Input
        placeholder="Що потрібно зробити?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />

      <div className="flex items-center gap-1.5">
        {ENERGY_OPTIONS.map((level) => {
          const isDisabled = disabledEnergyLevels.includes(level);
          return (
            <button
              key={level}
              type="button"
              disabled={isDisabled}
              onClick={() => setEnergyLevel(level)}
              className={cn(
                "flex size-8 items-center justify-center rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                energyLevel === level ? "border-foreground" : "border-transparent",
              )}
              aria-label={`Рівень енергії ${level}`}
            >
              <span className={cn("size-3 rounded-full", ENERGY_DOT_CLASS[level])} />
            </button>
          );
        })}

        <Input
          type="number"
          min={5}
          step={5}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value) || 0)}
          className="ml-2 w-20"
        />
        <span className="text-xs text-muted-foreground">хв</span>
      </div>

      <div className="flex items-center gap-1.5">
        {PRIORITY_OPTIONS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setPriority(level)}
            className={cn(
              "flex size-8 items-center justify-center rounded-full border-2 transition-colors",
              priority === level ? "border-foreground" : "border-transparent",
            )}
            aria-label={`Пріоритет ${PRIORITY_LABEL[level]}`}
          >
            <span className={cn("size-3 rounded-full", PRIORITY_DOT_CLASS[level])} />
          </button>
        ))}
        <span className="text-xs text-muted-foreground">{PRIORITY_LABEL[priority]}</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={projectId ?? ""}
          onChange={(e) => setProjectId(e.target.value || null)}
          className="h-9 flex-1 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">Inbox</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-9 rounded-md border bg-transparent px-3 text-sm text-muted-foreground"
        />
      </div>

      <Button type="submit" size="sm" className="w-full rounded-full">
        <Plus className="size-4" />
        Додати
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors, including `src/components/gentle/task-dashboard.tsx` (unmodified, still compiles against the new optional `projects` prop and the wider `onAdd` callback type).

- [ ] **Step 3: Commit**

```bash
git add src/components/gentle/quick-add-task-form.tsx
git commit --no-gpg-sign -m "feat: add project/priority/due-date pickers to QuickAddTaskForm"
```

---

## Task 5: AddTaskDialog + Fab

**Files:**
- Create: `src/components/gentle/add-task-dialog.tsx`
- Create: `src/components/gentle/fab.tsx`

**Interfaces:**
- Consumes: `addTask` from `@/app/actions` (Task 2); `QuickAddTaskForm` (Task 4); `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogTrigger` from `@/components/ui/dialog` (existing, from Block 1 — built on `@base-ui/react/dialog`, confirmed its `Dialog` root takes controlled `open`/`onOpenChange(open, eventDetails)` props and `DialogTrigger` renders a real `<button>` and forwards `className`/`children` like a normal component — no `render` prop needed here); `useResourceStatus` from `@/context/resource-status-context` (Task 3); `DbProject` from `@/types/gentle`.
- Produces (for Task 6's `AppShell`/`BottomNav`-adjacent wiring): `export function Fab({ projects }: { projects: DbProject[] }): JSX.Element` — self-contained, reads `isDepleted` itself via `useResourceStatus()`, no other props needed.

- [ ] **Step 1: Create `src/components/gentle/add-task-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QuickAddTaskForm } from "@/components/gentle/quick-add-task-form";
import { addTask } from "@/app/actions";
import type { DbProject, EnergyLevel, Priority } from "@/types/gentle";

interface AddTaskDialogProps {
  projects: DbProject[];
  disabledEnergyLevels?: EnergyLevel[];
  triggerClassName?: string;
  children: React.ReactNode;
}

export function AddTaskDialog({
  projects,
  disabledEnergyLevels = [],
  triggerClassName,
  children,
}: AddTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleAdd = async (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
    projectId: string | null;
    priority: Priority;
    dueDate: string | null;
  }) => {
    setErrorMessage(null);
    const result = await addTask(input);
    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
      <DialogTrigger className={triggerClassName}>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Нова задача</DialogTitle>
        </DialogHeader>
        {errorMessage && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
            {errorMessage}
          </p>
        )}
        <QuickAddTaskForm
          onAdd={handleAdd}
          disabledEnergyLevels={disabledEnergyLevels}
          projects={projects}
        />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create `src/components/gentle/fab.tsx`**

```tsx
"use client";

import { Plus } from "lucide-react";
import { AddTaskDialog } from "@/components/gentle/add-task-dialog";
import { useResourceStatus } from "@/context/resource-status-context";
import type { DbProject } from "@/types/gentle";

interface FabProps {
  projects: DbProject[];
}

export function Fab({ projects }: FabProps) {
  const { isDepleted } = useResourceStatus();

  return (
    <AddTaskDialog
      projects={projects}
      disabledEnergyLevels={isDepleted ? [3] : []}
      triggerClassName="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-rose-400 text-white shadow-lg transition-colors hover:bg-rose-500"
    >
      <Plus className="size-6" aria-hidden />
      <span className="sr-only">Нова задача</span>
    </AddTaskDialog>
  );
}
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors. `Fab` calls `useResourceStatus()`, which throws if rendered outside a `ResourceStatusProvider` — that's expected and fine, since nothing renders `Fab` yet until Task 6 wires it inside `AppShell` (which provides the context). No runtime check needed for this task.

- [ ] **Step 4: Commit**

```bash
git add src/components/gentle/add-task-dialog.tsx src/components/gentle/fab.tsx
git commit --no-gpg-sign -m "feat: add AddTaskDialog and FAB"
```

---

## Task 6: BottomNav + AppShell + (app) layout

**Files:**
- Create: `src/components/gentle/bottom-nav.tsx`
- Create: `src/components/gentle/app-shell.tsx`
- Create: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `ResourceStatusProvider`, `useResourceStatus` from `@/context/resource-status-context` (Task 3); `Fab` from `@/components/gentle/fab` (Task 5); `ResourceStatusToggle`, `DepletedBanner` (existing, unchanged, from Block 1); `signOut` from `@/app/actions`; `createClient` from `@/lib/supabase/server`; `DbProject`, `ResourceStatus` from `@/types/gentle`.
- Produces: the `(app)` route group's shared shell — Tasks 7 and 8's pages render as `{children}` inside it. No page exists under `(app)/` yet after this task, so there is nothing to browser-test end-to-end here; verify via `tsc`/`lint` only.

- [ ] **Step 1: Create `src/components/gentle/bottom-nav.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, CalendarCheck, CalendarDays, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  todayCount: number;
}

const TABS = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/today", label: "Сьогодні", icon: CalendarCheck },
  { href: "/upcoming", label: "Незабаром", icon: CalendarDays },
  { href: "/browse", label: "Огляд", icon: FolderOpen },
] as const;

export function BottomNav({ todayCount }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 flex items-center justify-around border-t bg-background/95 px-2 py-2 backdrop-blur">
      {TABS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-xs transition-colors",
              isActive ? "text-rose-500" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
            {href === "/today" && todayCount > 0 && (
              <span className="absolute -top-0.5 right-1 flex size-4 items-center justify-center rounded-full bg-rose-400 text-[10px] font-medium text-white">
                {todayCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create `src/components/gentle/app-shell.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { ResourceStatusProvider, useResourceStatus } from "@/context/resource-status-context";
import { ResourceStatusToggle } from "@/components/gentle/resource-status-toggle";
import { DepletedBanner } from "@/components/gentle/depleted-banner";
import { BottomNav } from "@/components/gentle/bottom-nav";
import { Fab } from "@/components/gentle/fab";
import { signOut } from "@/app/actions";
import type { DbProject, ResourceStatus } from "@/types/gentle";

function AppHeader() {
  const { resourceStatus, setResourceStatus, isDepleted } = useResourceStatus();

  return (
    <header className="flex flex-col items-center gap-4 px-4 pt-6">
      <div className="flex w-full items-center justify-between">
        <span className="size-5" aria-hidden />
        <h1 className="text-lg font-semibold">Gentle Productivity</h1>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Вийти"
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
      <ResourceStatusToggle value={resourceStatus} onChange={setResourceStatus} />
      {isDepleted && <DepletedBanner />}
    </header>
  );
}

interface AppShellProps {
  initialResourceStatus: ResourceStatus;
  projects: DbProject[];
  todayCount: number;
  children: ReactNode;
}

export function AppShell({
  initialResourceStatus,
  projects,
  todayCount,
  children,
}: AppShellProps) {
  return (
    <ResourceStatusProvider initialResourceStatus={initialResourceStatus}>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
        <AppHeader />
        <div className="flex-1 px-4 py-4">{children}</div>
        <BottomNav todayCount={todayCount} />
      </div>
      <Fab projects={projects} />
    </ResourceStatusProvider>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/layout.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/gentle/app-shell";
import type { DbProject, ResourceStatus } from "@/types/gentle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware (src/middleware.ts) redirects unauthenticated requests to
  // /login before this layout ever renders, so `user` is always present here.
  const userId = user!.id;

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: profile }, { data: projects }, { count: todayCount }] = await Promise.all([
    supabase.from("users").select("current_resource_status").eq("id", userId).single(),
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("due_date", today)
      .neq("status", "completed"),
  ]);

  return (
    <AppShell
      initialResourceStatus={(profile?.current_resource_status ?? "normal") as ResourceStatus}
      projects={(projects ?? []) as DbProject[]}
      todayCount={todayCount ?? 0}
    >
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors. No route under `(app)/` resolves to a page yet — that's expected (Task 7 adds the first ones) and not something to work around with a placeholder page in this task.

- [ ] **Step 5: Commit**

```bash
git add src/components/gentle/bottom-nav.tsx src/components/gentle/app-shell.tsx "src/app/(app)/layout.tsx"
git commit --no-gpg-sign -m "feat: add BottomNav, AppShell, and (app) route group layout"
```

---

## Task 7: TaskView + Inbox/Today/Upcoming pages, retire the sub-project-1 single page

**Files:**
- Create: `src/components/gentle/task-view.tsx`
- Create: `src/app/(app)/inbox/page.tsx`
- Create: `src/app/(app)/today/page.tsx`
- Create: `src/app/(app)/upcoming/page.tsx`
- Modify: `src/app/page.tsx` (full rewrite — becomes a one-line redirect)
- Delete: `src/components/gentle/task-dashboard.tsx` (retired — its logic is now split between `TaskView`, `AppShell`, and the FAB/dialog)

**Interfaces:**
- Consumes: `useResourceStatus` from `@/context/resource-status-context` (Task 3); `toggleTaskComplete` from `@/app/actions` (unchanged signature); `TaskList` (existing, unchanged); `createClient` from `@/lib/supabase/server`; `DbTask` from `@/types/gentle`.
- Produces: `export function TaskView({ initialTasks, emptyMessage }: { initialTasks: DbTask[]; emptyMessage?: string }): JSX.Element` — reused as-is by Task 8's project page too.

- [ ] **Step 1: Create `src/components/gentle/task-view.tsx`**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { TaskList } from "@/components/gentle/task-list";
import { toggleTaskComplete } from "@/app/actions";
import { useResourceStatus } from "@/context/resource-status-context";
import type { DbTask } from "@/types/gentle";

interface TaskViewProps {
  initialTasks: DbTask[];
  emptyMessage?: string;
}

export function TaskView({ initialTasks, emptyMessage }: TaskViewProps) {
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { isDepleted } = useResourceStatus();

  const visibleTasks = useMemo(
    () => (isDepleted ? tasks.filter((task) => task.energy_level < 3) : tasks),
    [tasks, isDepleted],
  );

  const handleToggleComplete = (task: DbTask) => {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await toggleTaskComplete(task.id, nextStatus);
      if ("error" in result) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
        setErrorMessage(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {errorMessage && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
          {errorMessage}
        </p>
      )}
      <TaskList
        tasks={visibleTasks}
        onToggleComplete={handleToggleComplete}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/inbox/page.tsx`**

```tsx
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
    .is("project_id", null)
    .order("created_at", { ascending: false });

  return (
    <TaskView initialTasks={(tasks ?? []) as DbTask[]} emptyMessage="Inbox порожній. Гарний знак 🌿" />
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/today/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { TaskView } from "@/components/gentle/task-view";
import type { DbTask } from "@/types/gentle";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("due_date", today)
    .order("created_at", { ascending: false });

  return (
    <TaskView
      initialTasks={(tasks ?? []) as DbTask[]}
      emptyMessage="На сьогодні задач немає. Саме час відпочити 🌿"
    />
  );
}
```

- [ ] **Step 4: Create `src/app/(app)/upcoming/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { TaskView } from "@/components/gentle/task-view";
import type { DbTask } from "@/types/gentle";

export default async function UpcomingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const today = new Date().toISOString().slice(0, 10);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .gt("due_date", today)
    .order("due_date", { ascending: true });

  return (
    <TaskView initialTasks={(tasks ?? []) as DbTask[]} emptyMessage="Немає запланованих задач 🌿" />
  );
}
```

- [ ] **Step 5: Replace `src/app/page.tsx` entirely**

```tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/inbox");
}
```

- [ ] **Step 6: Delete the retired sub-project-1 dashboard**

```bash
rm src/components/gentle/task-dashboard.tsx
```

- [ ] **Step 7: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors. This is the task where the temporary backward-compatibility shims from Tasks 2 and 4 stop mattering (their one caller is deleted) — do not re-add strictness to `addTask`/`QuickAddTaskForm` as a "cleanup," that's unrelated scope; leave them as-is.

- [ ] **Step 8: Manual verification (requires Task 1's migration applied)**

```bash
npm run dev
```

Log in with an existing test account. Confirm in the browser:
- Visiting `/` redirects to `/inbox`.
- The bottom nav shows 4 tabs (Inbox/Сьогодні/Незабаром/Огляд) with Inbox highlighted; clicking Today/Upcoming navigates and highlights correctly (Browse will 404 until Task 8 — that's expected here).
- The FAB (red circle, bottom-right) opens a dialog with the extended add form (energy picker, priority picker, project `<select>` showing just "Inbox" since no projects exist yet, due-date input).
- Creating a task with no due date appears in Inbox after the dialog closes (via the `router.refresh()` this task's `AddTaskDialog` triggers — no manual reload needed).
- Creating a task with today's due date appears in Today, and the Today nav tab shows a count badge.
- Creating a task with tomorrow's due date appears in Upcoming, not Today.
- Toggling "Виснажена" in the header hides `energy_level = 3` tasks and shows the banner — check this is consistent across Inbox and Today (navigate between them without toggling again).

Stop the dev server after confirming.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit --no-gpg-sign -m "feat: add TaskView and Inbox/Today/Upcoming pages, retire single-page dashboard"
```

---

## Task 8: Browse (projects list + create) + project detail page

**Files:**
- Create: `src/components/gentle/create-project-form.tsx`
- Create: `src/app/(app)/browse/page.tsx`
- Create: `src/app/(app)/browse/[projectId]/page.tsx`

**Interfaces:**
- Consumes: `createProject` from `@/app/actions` (Task 2); `TaskView` from `@/components/gentle/task-view` (Task 7); `createClient` from `@/lib/supabase/server`.
- Produces: nothing consumed by later tasks — this is the last feature task before verification.

- [ ] **Step 1: Create `src/components/gentle/create-project-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { createProject } from "@/app/actions";

export function CreateProjectForm() {
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setErrorMessage(null);
    const result = await createProject(trimmed);
    if ("error" in result) {
      setErrorMessage(result.error);
      return;
    }
    setName("");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Назва нового проєкту"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" size="sm" className="rounded-full">
          <Plus className="size-4" />
        </Button>
      </div>
      {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}
    </form>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/browse/page.tsx`**

```tsx
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CreateProjectForm } from "@/components/gentle/create-project-form";

export default async function BrowsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, tasks(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <CreateProjectForm />

      <div className="flex flex-col gap-2">
        {(projects ?? []).length === 0 && (
          <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Проєктів поки немає — створи перший вище.
          </p>
        )}
        {(projects ?? []).map((project) => (
          <Link
            key={project.id}
            href={`/browse/${project.id}`}
            className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:bg-muted/40"
          >
            <FolderOpen className="size-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">{project.name}</span>
            <span className="text-xs text-muted-foreground">
              {(project.tasks as { count: number }[])[0]?.count ?? 0}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

`tasks(count)` is PostgREST's embedded-resource count syntax (Supabase-JS passes the `select` string straight through) — it returns `tasks: [{ count: number }]` per row. This is the trickiest new API surface in this task; verify it live in Step 5 rather than trusting it from reading alone.

- [ ] **Step 3: Create `src/app/(app)/browse/[projectId]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaskView } from "@/components/gentle/task-view";
import type { DbTask } from "@/types/gentle";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (!project) {
    notFound();
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">{project.name}</h2>
      <TaskView
        initialTasks={(tasks ?? []) as DbTask[]}
        emptyMessage="У цьому проєкті поки немає задач 🌿"
      />
    </div>
  );
}
```

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors.

- [ ] **Step 5: Manual verification (requires Task 1's migration applied)**

```bash
npm run dev
```

Confirm in the browser:
- `/browse` shows the create-project form and (initially) the empty-state message.
- Creating a project ("Робота", for example) makes it appear in the list with a `0` count, without a manual reload (via `router.refresh()`).
- Opening it navigates to `/browse/<id>` and shows its name as a heading plus an empty task list.
- Open the FAB from anywhere, create a task and assign it to "Робота" via the project `<select>` — go to `/browse/<id>` (reload if needed, since the FAB's `router.refresh()` only refreshes the route it was opened from) and confirm the task appears there and its count on `/browse` is now `1`.
- Visiting `/browse/<a-random-uuid-that-does-not-exist>` renders a 404 (via `notFound()`), not a crash.

Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/components/gentle/create-project-form.tsx "src/app/(app)/browse"
git commit --no-gpg-sign -m "feat: add Browse projects list, create-project form, and project detail page"
```

---

## Task 9: Full end-to-end verification pass

**Files:** none (verification only)

**Interfaces:** none — this task exercises everything built in Tasks 1–8 together.

- [ ] **Step 1: Run the full check suite**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors.

- [ ] **Step 2: Confirm the migration is applied**

If not already done in Task 1, apply `supabase/migrations/0002_projects_priority.sql` via the Supabase SQL Editor before proceeding — every check below needs it live.

- [ ] **Step 3: Walk the spec's verification checklist end-to-end**

```bash
npm run dev
```

Using an existing (or fresh) test account:
1. `/` redirects to `/inbox`; a brand-new account shows an empty Inbox.
2. FAB creates a task with no project/priority/date set → appears in Inbox, defaults are P4/no due date (spot-check via a direct Supabase query or trust the schema `default 4` — no UI shows priority yet, that's sub-project 3).
3. A task due today appears in Today with the nav badge count incrementing; a task due tomorrow appears in Upcoming, not Today; reload (`F5`) on each tab — everything persists (real DB).
4. Create a project in Browse, assign a new task to it via the FAB, confirm it shows under `/browse/[projectId]` and not in Inbox.
5. Toggle "Виснажена" in the header — confirm `energy_level = 3` tasks are hidden consistently across Inbox, Today, Upcoming, and a project's page (navigate between all four without re-toggling).
6. Log out, log back in — all of the above persists.

- [ ] **Step 4: Report results**

If every check in Step 3 passes, sub-project 2 (2 of 4) is complete. If anything fails, note which numbered check failed and the exact behavior observed before moving on to sub-project 3 (task card redesign) — do not build the card redesign on top of a known-broken nav/data layer.
