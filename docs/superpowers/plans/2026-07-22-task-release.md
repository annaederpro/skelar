# Task Release ("Відпустити в океан" / Кошик) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user swipe a task card away to soft-delete it ("release" it), with an undo toast and a permanent "Кошик" trash view to restore from later.

**Architecture:** One nullable `released_at` timestamp column on `tasks` (no enum/status changes). Every existing task query gets a `released_at is null` filter; a new "Кошик" route queries the inverse. A hand-rolled `SwipeToRelease` pointer-event wrapper triggers an optimistic client-side removal + `releaseTask` server action; a toast offers `restoreTask` as undo, and the trash page's "Повернути" button calls the exact same `restoreTask` action.

**Tech Stack:** Next.js 16 (Server Components + Server Actions), Supabase (`supabase-js`), Tailwind v4, plain CSS keyframes, no new npm dependencies (no gesture/animation/toast library — this project has none today and doesn't need one for this feature).

## Global Constraints

- No new npm dependency. Swipe tracking uses native Pointer Events; the release animation is CSS keyframes.
- Swipe triggers release in **either horizontal direction** — the threshold is on absolute drag distance, not a specific direction.
- The release is **instant on a full swipe** — no confirmation dialog/tap-to-confirm step.
- Fixed toast copy, exact strings: lead line `"Пішло в безодню 🌊"`, body `"Це нормально — змінювати плани. Ти звільнив місце для чогось важливішого."`, button `"Скасувати"`.
- The trash page/link is labeled **"Кошик"** everywhere it's a navigation target (page title, header link). The word "безодня"/"abyss" appears only in the toast copy above — nowhere else in the UI.
- The trash is **not** a 5th bottom-nav tab — it's reachable via a header link from "Всі задачі" (`/inbox`) at its own route (`/trash`).
- Undo and the trash page's restore button call the **same** `restoreTask` server action — one restore code path, not two.
- `status` (`todo`/`completed`) is never touched by release/restore — only `released_at` changes, so a restored task always comes back exactly as it was.
- This repo has no automated test runner (confirmed: no `jest`/`vitest`/`pytest` in `package.json`/`devDependencies`). Verification in every task below is `npx tsc --noEmit`, `npx eslint`, and manual interaction via the `preview_*` tools — matching how the rest of this codebase is verified (see `docs/superpowers/specs/2026-07-21-telegram-voice-capture-design.md`'s Testing section for precedent).
- Migrations in this repo are applied by hand in the Supabase SQL editor (no `supabase` CLI installed, no DB connection string available to any tool) — every prior migration file (`0001`–`0004`) carries this same manual-apply expectation. Task 1 below has an explicit manual checkpoint for this.

---

## Task 1: Database migration + `DbTask` type

**Files:**
- Create: `supabase/migrations/0005_task_release.sql`
- Modify: `src/types/gentle.ts:24-40` (the `DbTask` interface)

**Interfaces:**
- Produces: `DbTask.released_at: string | null` — every later task that touches a `DbTask` object relies on this field existing.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0005_task_release.sql
alter table public.tasks add column if not exists released_at timestamptz;
create index if not exists tasks_released_at_idx on public.tasks(released_at);
```

No RLS changes needed: release/restore are plain `update`s on a row the
user already owns, covered by the existing "Users can update own tasks"
policy from `0001_init.sql`.

- [ ] **Step 2: Add the field to `DbTask`**

In `src/types/gentle.ts`, the `DbTask` interface currently ends with:

```ts
  // Added by migration 0003 (Phase 2 — Focus). Absent/false until then.
  is_seeded: boolean;
}
```

Change it to:

```ts
  // Added by migration 0003 (Phase 2 — Focus). Absent/false until then.
  is_seeded: boolean;
  // Added by migration 0005 (Task Release). Null = active task; set = soft-
  // deleted, recoverable from "Кошик" until restored (released_at cleared).
  released_at: string | null;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (this step only adds a field; nothing reads it yet).

- [ ] **Step 4: ⚠️ Manual action required — apply the migration**

Open the Supabase dashboard's SQL Editor for this project and run the
contents of `supabase/migrations/0005_task_release.sql`. Confirm it worked:

```sql
select column_name from information_schema.columns
where table_name = 'tasks' and column_name = 'released_at';
```

Expected: one row, `released_at`. **Every task from Task 3 onward assumes
this has been done** — the new query filters (`released_at is null`) will
error against a live Supabase instance until this column exists.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_task_release.sql src/types/gentle.ts
git commit --no-gpg-sign -m "feat: add released_at column for task release/trash"
```

---

## Task 2: Server actions — `releaseTask` / `restoreTask`

**Files:**
- Modify: `src/app/actions.ts` (add two new exported functions after `toggleTaskComplete`, which ends at line 180)

**Interfaces:**
- Consumes: nothing new (same `createClient()` / `supabase.auth.getUser()` pattern every other action in this file already uses).
- Produces: `releaseTask(taskId: string): Promise<{ ok: true } | { error: string }>`, `restoreTask(taskId: string): Promise<{ ok: true } | { error: string }>` — every UI task below calls these two by name.

- [ ] **Step 1: Add the two actions**

In `src/app/actions.ts`, insert immediately after `toggleTaskComplete`'s
closing brace (after line 180, before `export async function
updateResourceStatus`):

```ts
export async function releaseTask(taskId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ released_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    return { error: "Не вдалося оновити задачу." };
  }

  return { ok: true };
}

export async function restoreTask(taskId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ released_at: null })
    .eq("id", taskId);

  if (error) {
    return { error: "Не вдалося оновити задачу." };
  }

  return { ok: true };
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/app/actions.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions.ts
git commit --no-gpg-sign -m "feat: add releaseTask/restoreTask server actions"
```

---

## Task 3: Exclude released tasks from every existing query

**Files:**
- Modify: `src/app/(app)/today/page.tsx:15-21`
- Modify: `src/app/(app)/upcoming/page.tsx:12-19`
- Modify: `src/app/(app)/inbox/page.tsx:20-24`
- Modify: `src/app/(app)/browse/[projectId]/page.tsx:29-34`
- Modify: `src/app/(app)/aquarium/page.tsx:23-35`
- Modify: `src/app/(app)/layout.tsx:18-42`

**Interfaces:**
- Consumes: `DbTask.released_at` (Task 1).

All six files add one `.is("released_at", null)` call to their existing
`supabase.from("tasks")...` chains. This is the same filter method already
used in this codebase (`upcoming/page.tsx` already calls
`.not("due_date", "is", null)`), just the positive form.

- [ ] **Step 1: `today/page.tsx`**

Replace:

```ts
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("due_date", today)
    .order("due_time", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });
```

with:

```ts
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .is("released_at", null)
    .eq("due_date", today)
    .order("due_time", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });
```

- [ ] **Step 2: `upcoming/page.tsx`**

Replace:

```ts
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .not("due_date", "is", null)
    .neq("status", "completed")
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: true });
```

with:

```ts
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .is("released_at", null)
    .not("due_date", "is", null)
    .neq("status", "completed")
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: true });
```

- [ ] **Step 3: `inbox/page.tsx`**

Replace:

```ts
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
```

with:

```ts
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .is("released_at", null)
    .order("created_at", { ascending: false });
```

- [ ] **Step 4: `browse/[projectId]/page.tsx`**

Replace:

```ts
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
```

with:

```ts
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .is("released_at", null)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
```

- [ ] **Step 5: `aquarium/page.tsx` (both queries)**

Replace:

```ts
  const [{ count: fishCount }, { count: eggCount }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "todo")
      .eq("is_seeded", true),
  ]);
```

with:

```ts
  const [{ count: fishCount }, { count: eggCount }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("released_at", null)
      .eq("status", "completed"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("released_at", null)
      .eq("status", "todo")
      .eq("is_seeded", true),
  ]);
```

- [ ] **Step 6: `layout.tsx` (both queries)**

Replace:

```ts
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("due_date", today)
        .neq("status", "completed"),
      // Full open-task pool for the cross-cutting Focus suggestion — not
      // scoped to whichever route's own filtered query is active, so a
      // task assigned to a project or dated for later can still surface.
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(300),
```

with:

```ts
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("released_at", null)
        .eq("due_date", today)
        .neq("status", "completed"),
      // Full open-task pool for the cross-cutting Focus suggestion — not
      // scoped to whichever route's own filtered query is active, so a
      // task assigned to a project or dated for later can still surface.
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .is("released_at", null)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(300),
```

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/app`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/today/page.tsx src/app/\(app\)/upcoming/page.tsx \
  src/app/\(app\)/inbox/page.tsx "src/app/(app)/browse/[projectId]/page.tsx" \
  src/app/\(app\)/aquarium/page.tsx src/app/\(app\)/layout.tsx
git commit --no-gpg-sign -m "feat: exclude released tasks from all task queries"
```

---

## Task 4: `SwipeToRelease` component + release animation CSS

**Files:**
- Create: `src/components/gentle/swipe-to-release.tsx`
- Modify: `src/app/globals.css` (append keyframes)

**Interfaces:**
- Produces: `SwipeToRelease({ onRelease: () => void; children: ReactNode })` — a client component that wraps a single card, tracks a horizontal drag, and calls `onRelease` once its own exit + collapse animation has fully played. It does **not** touch task state or call any server action itself.

- [ ] **Step 1: Add the animation keyframes to `globals.css`**

Append to the end of `src/app/globals.css` (after the existing
`@media (pointer: coarse)` block):

```css
/* Task Release: bubbles + glow that play over a card as it's swiped away. */
@keyframes release-bubble {
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0;
  }
  15% {
    opacity: 0.8;
  }
  100% {
    transform: translateY(-90px) scale(1);
    opacity: 0;
  }
}
@keyframes release-glow {
  0% {
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
.release-bubble {
  position: absolute;
  bottom: 6px;
  border-radius: 9999px;
  background: rgba(62, 142, 156, 0.45);
  animation: release-bubble 480ms ease-out forwards;
}
.release-glow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(ellipse at center, rgba(62, 142, 156, 0.35) 0%, rgba(62, 142, 156, 0) 70%);
  animation: release-glow 480ms ease-out forwards;
  pointer-events: none;
}
```

- [ ] **Step 2: Create `swipe-to-release.tsx`**

```tsx
"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

interface SwipeToReleaseProps {
  onRelease: () => void;
  children: ReactNode;
}

const DECISION_PX = 8; // movement needed before we decide horizontal-drag vs vertical-scroll
const CLICK_THRESHOLD_PX = 6; // below this, treat pointerup as a tap, not a drag
const RELEASE_FRACTION = 0.32; // fraction of card width that commits a release
const EXIT_MS = 260;
const COLLAPSE_MS = 220;

export function SwipeToRelease({ onRelease, children }: SwipeToReleaseProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const draggingRef = useRef(false);
  const lockedHorizontalRef = useRef<boolean | null>(null);
  const suppressClickRef = useRef(false);

  const [dragX, setDragX] = useState(0);
  const [phase, setPhase] = useState<"idle" | "dragging" | "exiting" | "collapsing">("idle");
  const [collapseHeight, setCollapseHeight] = useState<number | null>(null);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "idle") return;
    draggingRef.current = true;
    lockedHorizontalRef.current = null;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (lockedHorizontalRef.current === null) {
      if (Math.abs(dx) < DECISION_PX && Math.abs(dy) < DECISION_PX) return;
      lockedHorizontalRef.current = Math.abs(dx) > Math.abs(dy);
      if (lockedHorizontalRef.current) {
        wrapperRef.current?.setPointerCapture(e.pointerId);
        setPhase("dragging");
      } else {
        draggingRef.current = false; // hand off to native vertical scroll
        return;
      }
    }

    if (!lockedHorizontalRef.current) return;
    setDragX(dx);
  };

  const commitRelease = (direction: 1 | -1) => {
    const el = wrapperRef.current;
    const width = el?.offsetWidth ?? 320;
    const height = el?.offsetHeight ?? 64;
    suppressClickRef.current = true;
    setPhase("exiting");
    setDragX(direction * (width + 60));
    window.setTimeout(() => {
      setCollapseHeight(height);
      requestAnimationFrame(() => setCollapseHeight(0));
      window.setTimeout(onRelease, COLLAPSE_MS);
    }, EXIT_MS);
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (!lockedHorizontalRef.current) return;

    const el = wrapperRef.current;
    const width = el?.offsetWidth ?? 320;
    if (Math.abs(dragX) > width * RELEASE_FRACTION) {
      commitRelease(dragX > 0 ? 1 : -1);
      return;
    }
    if (Math.abs(dragX) > CLICK_THRESHOLD_PX) {
      suppressClickRef.current = true;
    }
    setPhase("idle");
    setDragX(0);
  };

  const handleClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  };

  const isAnimating = phase === "exiting" || phase === "collapsing";

  return (
    <div
      ref={wrapperRef}
      className="relative"
      style={{
        overflow: "hidden",
        touchAction: "pan-y",
        maxHeight: collapseHeight ?? undefined,
        transition: phase === "collapsing" ? `max-height ${COLLAPSE_MS}ms ease` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
    >
      <div
        style={{
          transform: `translateX(${dragX}px)`,
          transition:
            phase === "idle" || phase === "exiting"
              ? `transform ${phase === "exiting" ? EXIT_MS : 180}ms ease`
              : undefined,
        }}
      >
        {children}
      </div>
      {isAnimating && (
        <div className="release-glow" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className="release-bubble"
              style={{
                left: `${12 + i * 15}%`,
                width: 6 + (i % 3) * 3,
                height: 6 + (i % 3) * 3,
                animationDelay: `${i * 35}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/swipe-to-release.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/gentle/swipe-to-release.tsx src/app/globals.css
git commit --no-gpg-sign -m "feat: add SwipeToRelease gesture component + release animation"
```

---

## Task 5: `TaskCard` gains a `released` variant

**Files:**
- Modify: `src/components/gentle/task-card.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TaskCard`'s props gain `variant?: "active" | "released"` (default `"active"`) and `onRestore?: (task: DbTask) => void`. In `"released"` mode: the checkbox becomes a static non-interactive indicator, the card is not click-to-edit, and a **Повернути** button (calling `onRestore`) appears.

- [ ] **Step 1: Update imports and props**

Replace the top of `src/components/gentle/task-card.tsx`:

```tsx
import { Clock, Check, Folder, CalendarDays } from "lucide-react";
```

with:

```tsx
import { Clock, Check, Folder, CalendarDays, Waves, Undo2 } from "lucide-react";
```

Replace:

```tsx
interface TaskCardProps {
  task: DbTask;
  projectName?: string;
  onToggleComplete?: (task: DbTask) => void;
  onEdit?: (task: DbTask) => void;
}
```

with:

```tsx
interface TaskCardProps {
  task: DbTask;
  projectName?: string;
  variant?: "active" | "released";
  onToggleComplete?: (task: DbTask) => void;
  onEdit?: (task: DbTask) => void;
  onRestore?: (task: DbTask) => void;
}
```

- [ ] **Step 2: Update the component body**

Replace:

```tsx
export function TaskCard({ task, projectName, onToggleComplete, onEdit }: TaskCardProps) {
  const isCompleted = task.status === "completed";
  const bucket = priorityBucket(task.priority);
  const isSeeded = task.is_seeded && !isCompleted;
  const isDueUrgent =
    !isCompleted && task.due_date !== null && task.due_date <= getAppToday();

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-[20px] border border-line bg-card p-[14px_15px] shadow-sm transition-all",
        isCompleted && "bg-paper/60",
      )}
    >
      {/* left accent bar: coral for high priority, sea for a seeded task */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          isSeeded ? "bg-sea" : PRIORITY_BUCKET_BAR_CLASS[bucket],
          isCompleted && "opacity-50",
        )}
        aria-hidden
      />

      <button
        type="button"
        onClick={() => onToggleComplete?.(task)}
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          isCompleted
            ? "border-sea bg-sea text-white"
            : "border-ink-soft/30 text-transparent hover:border-sea",
        )}
        aria-label={isCompleted ? "Позначити як невиконану" : "Позначити як виконану"}
      >
        <Check className="size-[14px]" strokeWidth={3.5} />
      </button>

      <div
        className="min-w-0 flex-1 cursor-pointer"
        role="button"
        tabIndex={onEdit ? 0 : -1}
        onClick={() => onEdit?.(task)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit?.(task);
          }
        }}
      >
```

with:

```tsx
export function TaskCard({
  task,
  projectName,
  variant = "active",
  onToggleComplete,
  onEdit,
  onRestore,
}: TaskCardProps) {
  const isCompleted = task.status === "completed";
  const bucket = priorityBucket(task.priority);
  const isSeeded = task.is_seeded && !isCompleted;
  const isDueUrgent =
    !isCompleted && task.due_date !== null && task.due_date <= getAppToday();
  const isReleased = variant === "released";
  const isEditable = Boolean(onEdit) && !isReleased;

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-[20px] border border-line bg-card p-[14px_15px] shadow-sm transition-all",
        isCompleted && "bg-paper/60",
      )}
    >
      {/* left accent bar: coral for high priority, sea for a seeded task */}
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          isSeeded ? "bg-sea" : PRIORITY_BUCKET_BAR_CLASS[bucket],
          isCompleted && "opacity-50",
        )}
        aria-hidden
      />

      {isReleased ? (
        <span
          className="flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 border-line text-ink-soft/50"
          aria-hidden
        >
          <Waves className="size-[13px]" />
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onToggleComplete?.(task)}
          className={cn(
            "flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            isCompleted
              ? "border-sea bg-sea text-white"
              : "border-ink-soft/30 text-transparent hover:border-sea",
          )}
          aria-label={isCompleted ? "Позначити як невиконану" : "Позначити як виконану"}
        >
          <Check className="size-[14px]" strokeWidth={3.5} />
        </button>
      )}

      <div
        className={cn("min-w-0 flex-1", isEditable && "cursor-pointer")}
        role={isEditable ? "button" : undefined}
        tabIndex={isEditable ? 0 : -1}
        onClick={isEditable ? () => onEdit?.(task) : undefined}
        onKeyDown={
          isEditable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onEdit?.(task);
                }
              }
            : undefined
        }
      >
```

- [ ] **Step 3: Add the restore button**

Immediately before the closing `</div>` of the component (after the
details `<div>` that contains duration/effort/due-date/project, and
before the component's final closing tag), add:

```tsx
      {isReleased && (
        <button
          type="button"
          onClick={() => onRestore?.(task)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-sea-soft px-2.5 py-1.5 text-[11.5px] font-bold text-sea-deep transition-colors hover:bg-sea-soft/70"
        >
          <Undo2 className="size-3.5" />
          Повернути
        </button>
      )}
```

So the end of the component reads (details div unchanged, new button
after it, then the outer div closes):

```tsx
          {isSeeded && (
            <span className="font-bold text-sea-deep">🥚 ікринка</span>
          )}
        </div>
      </div>

      {isReleased && (
        <button
          type="button"
          onClick={() => onRestore?.(task)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-sea-soft px-2.5 py-1.5 text-[11.5px] font-bold text-sea-deep transition-colors hover:bg-sea-soft/70"
        >
          <Undo2 className="size-3.5" />
          Повернути
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/task-card.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/gentle/task-card.tsx
git commit --no-gpg-sign -m "feat: add released variant to TaskCard"
```

---

## Task 6: `TaskList` wires swipe-to-release and the released variant together

**Files:**
- Modify: `src/components/gentle/task-list.tsx`

**Interfaces:**
- Consumes: `SwipeToRelease` (Task 4), `TaskCard`'s `variant`/`onRestore` (Task 5).
- Produces: `TaskList`'s props gain `mode?: "active" | "released"` (default `"active"`), `onReleaseTask?: (task: DbTask) => void`, `onRestoreTask?: (task: DbTask) => void`. In `"active"` mode (and when `onReleaseTask` is passed), each card is wrapped in `SwipeToRelease`. In `"released"` mode, cards render directly with a **Повернути** button, no swipe.

- [ ] **Step 1: Replace the file**

```tsx
import { TaskCard } from "@/components/gentle/task-card";
import { SwipeToRelease } from "@/components/gentle/swipe-to-release";
import type { DbTask } from "@/types/gentle";

interface TaskListProps {
  tasks: DbTask[];
  projectNameById?: Map<string, string>;
  mode?: "active" | "released";
  onToggleComplete?: (task: DbTask) => void;
  onEditTask?: (task: DbTask) => void;
  onReleaseTask?: (task: DbTask) => void;
  onRestoreTask?: (task: DbTask) => void;
  emptyMessage?: string;
}

export function TaskList({
  tasks,
  projectNameById,
  mode = "active",
  onToggleComplete,
  onEditTask,
  onReleaseTask,
  onRestoreTask,
  emptyMessage = "Задач на сьогодні поки немає. Саме час відпочити 🌿",
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-2xl bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => {
        const card = (
          <TaskCard
            task={task}
            variant={mode}
            projectName={task.project_id ? projectNameById?.get(task.project_id) : undefined}
            onToggleComplete={mode === "active" ? onToggleComplete : undefined}
            onEdit={mode === "active" ? onEditTask : undefined}
            onRestore={mode === "released" ? onRestoreTask : undefined}
          />
        );

        if (mode === "released" || !onReleaseTask) {
          return <div key={task.id}>{card}</div>;
        }

        return (
          <SwipeToRelease key={task.id} onRelease={() => onReleaseTask(task)}>
            {card}
          </SwipeToRelease>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/task-list.tsx`
Expected: no errors. (Existing callers in `task-view.tsx`/`upcoming-view.tsx`
don't pass `onReleaseTask` yet, so `mode` defaults to `"active"` and
`onReleaseTask` is `undefined` — cards render without the swipe wrapper,
unchanged behavior, until Tasks 8–9 wire it up.)

- [ ] **Step 3: Commit**

```bash
git add src/components/gentle/task-list.tsx
git commit --no-gpg-sign -m "feat: wire SwipeToRelease and released mode into TaskList"
```

---

## Task 7: `ReleaseToast` component

**Files:**
- Create: `src/components/gentle/release-toast.tsx`

**Interfaces:**
- Produces: `ReleaseToast({ task: { id: string; title: string } | null; onUndo: () => void; onDismiss: () => void })`. Renders nothing when `task` is `null`. Auto-calls `onDismiss` 5s after a non-null `task` is set.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect } from "react";

interface ReleaseToastProps {
  task: { id: string; title: string } | null;
  onUndo: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

export function ReleaseToast({ task, onUndo, onDismiss }: ReleaseToastProps) {
  useEffect(() => {
    if (!task) return;
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [task, onDismiss]);

  if (!task) return null;

  return (
    <div className="fixed inset-x-0 bottom-[84px] z-40 mx-auto flex w-full max-w-md justify-center px-4">
      <div className="flex w-full items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-white/80">Пішло в безодню 🌊</p>
          <p className="mt-0.5 text-[13px] leading-snug text-white/90">
            Це нормально — змінювати плани. Ти звільнив місце для чогось важливішого.
          </p>
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-extrabold text-white transition-colors hover:bg-white/25"
        >
          Скасувати
        </button>
      </div>
    </div>
  );
}
```

`bottom-[84px]` clears the `BottomNav` (which sits at `bottom-0` with its
own padding/icon/label height) — Task 10's live-preview check confirms this
visually and adjusts the value if the toast overlaps the nav on a real
mobile viewport.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/release-toast.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/gentle/release-toast.tsx
git commit --no-gpg-sign -m "feat: add ReleaseToast component"
```

---

## Task 8: Wire release + undo into `TaskView`

**Files:**
- Modify: `src/components/gentle/task-view.tsx`

**Interfaces:**
- Consumes: `releaseTask`, `restoreTask` (Task 2), `TaskList`'s `onReleaseTask` (Task 6), `ReleaseToast` (Task 7).

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { toggleTaskComplete, createProject } from "@/app/actions";
```

with:

```tsx
import { toggleTaskComplete, createProject, releaseTask, restoreTask } from "@/app/actions";
```

Add, alongside the other component imports at the top of the file:

```tsx
import { ReleaseToast } from "@/components/gentle/release-toast";
```

- [ ] **Step 2: Add toast state and handlers**

Immediately after the existing `handleToggleComplete` function (which ends
with `router.refresh(); }); };` around line 78), add:

```tsx
  const [releasedTask, setReleasedTask] = useState<{ id: string; title: string } | null>(null);

  const handleRelease = (task: DbTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await releaseTask(task.id);
      if ("error" in result) {
        setTasks((prev) => [task, ...prev]);
        setErrorMessage(result.error);
        return;
      }
      setReleasedTask({ id: task.id, title: task.title });
      router.refresh();
    });
  };

  const handleUndoRelease = () => {
    if (!releasedTask) return;
    const id = releasedTask.id;
    setReleasedTask(null);
    startTransition(async () => {
      const result = await restoreTask(id);
      if ("error" in result) {
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  };
```

`releasedTask` needs to sit alongside the other `useState` declarations
near the top of the component (it can be declared right there instead —
either placement works since it's just a `useState` call; keep it next to
the handler for readability).

- [ ] **Step 3: Pass the new prop to `TaskList` and render the toast**

Replace:

```tsx
      <TaskList
        tasks={visibleTasks}
        projectNameById={projectNameById}
        onToggleComplete={handleToggleComplete}
        onEditTask={setEditingTask}
        emptyMessage={
          projectFilter !== "all" && tasks.length > 0
            ? "У цьому проєкті поки порожньо 🌊"
            : emptyMessage
        }
      />
```

with:

```tsx
      <TaskList
        tasks={visibleTasks}
        projectNameById={projectNameById}
        onToggleComplete={handleToggleComplete}
        onEditTask={setEditingTask}
        onReleaseTask={handleRelease}
        emptyMessage={
          projectFilter !== "all" && tasks.length > 0
            ? "У цьому проєкті поки порожньо 🌊"
            : emptyMessage
        }
      />
```

Then, immediately after the closing `/>` of `EditTaskDialog` (the last
element before the component's final closing `</div>`), add:

```tsx
      <ReleaseToast
        task={releasedTask}
        onUndo={handleUndoRelease}
        onDismiss={() => setReleasedTask(null)}
      />
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/task-view.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/gentle/task-view.tsx
git commit --no-gpg-sign -m "feat: wire task release + undo into TaskView"
```

---

## Task 9: Wire release + undo into `UpcomingView`

**Files:**
- Modify: `src/components/gentle/upcoming-view.tsx`

**Interfaces:**
- Consumes: same as Task 8 — this mirrors it because `UpcomingView` is a
  separate component from `TaskView` that duplicates
  `handleToggleComplete`-style logic already (see its existing
  `handleToggleComplete`, identical to `TaskView`'s). This plan follows
  that existing duplication precedent rather than introducing a new shared
  hook neither file uses today.

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { toggleTaskComplete, createProject } from "@/app/actions";
```

with:

```tsx
import { toggleTaskComplete, createProject, releaseTask, restoreTask } from "@/app/actions";
```

Add:

```tsx
import { ReleaseToast } from "@/components/gentle/release-toast";
```

- [ ] **Step 2: Add toast state and handlers**

Immediately after the existing `handleToggleComplete` function (ends
around line 106 with `router.refresh(); }); };`), add the identical block
used in Task 8:

```tsx
  const [releasedTask, setReleasedTask] = useState<{ id: string; title: string } | null>(null);

  const handleRelease = (task: DbTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await releaseTask(task.id);
      if ("error" in result) {
        setTasks((prev) => [task, ...prev]);
        setErrorMessage(result.error);
        return;
      }
      setReleasedTask({ id: task.id, title: task.title });
      router.refresh();
    });
  };

  const handleUndoRelease = () => {
    if (!releasedTask) return;
    const id = releasedTask.id;
    setReleasedTask(null);
    startTransition(async () => {
      const result = await restoreTask(id);
      if ("error" in result) {
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  };
```

- [ ] **Step 3: Pass `onReleaseTask` to both `TaskList` usages**

`UpcomingView` renders `TaskList` twice — once for `overdueTasks`, once
per day in `groupedUpcoming`. Add `onReleaseTask={handleRelease}` to both:

Replace:

```tsx
              <TaskList
                tasks={overdueTasks}
                projectNameById={projectNameById}
                onToggleComplete={handleToggleComplete}
                onEditTask={setEditingTask}
              />
```

with:

```tsx
              <TaskList
                tasks={overdueTasks}
                projectNameById={projectNameById}
                onToggleComplete={handleToggleComplete}
                onEditTask={setEditingTask}
                onReleaseTask={handleRelease}
              />
```

Replace:

```tsx
              <TaskList
                tasks={dayTasks}
                projectNameById={projectNameById}
                onToggleComplete={handleToggleComplete}
                onEditTask={setEditingTask}
              />
```

with:

```tsx
              <TaskList
                tasks={dayTasks}
                projectNameById={projectNameById}
                onToggleComplete={handleToggleComplete}
                onEditTask={setEditingTask}
                onReleaseTask={handleRelease}
              />
```

- [ ] **Step 4: Render the toast**

Immediately after the closing `/>` of `EditTaskDialog` (the last element
before the component's final closing `</div>`), add:

```tsx
      <ReleaseToast
        task={releasedTask}
        onUndo={handleUndoRelease}
        onDismiss={() => setReleasedTask(null)}
      />
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/upcoming-view.tsx`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/gentle/upcoming-view.tsx
git commit --no-gpg-sign -m "feat: wire task release + undo into UpcomingView"
```

---

## Task 10: "Кошик" trash page

**Files:**
- Create: `src/components/gentle/trash-view.tsx`
- Create: `src/app/(app)/trash/page.tsx`

**Interfaces:**
- Consumes: `restoreTask` (Task 2), `TaskList`'s `mode="released"` (Task 6).
- Produces: route `/trash`.

- [ ] **Step 1: Create `trash-view.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TaskList } from "@/components/gentle/task-list";
import { restoreTask } from "@/app/actions";
import type { DbTask } from "@/types/gentle";

interface TrashViewProps {
  initialTasks: DbTask[];
}

export function TrashView({ initialTasks }: TrashViewProps) {
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [syncedTasks, setSyncedTasks] = useState(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (initialTasks !== syncedTasks) {
    setSyncedTasks(initialTasks);
    setTasks(initialTasks);
  }

  const handleRestore = (task: DbTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await restoreTask(task.id);
      if ("error" in result) {
        setTasks((prev) => [task, ...prev]);
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {errorMessage && (
        <p className="rounded-xl bg-coral-soft/60 px-3 py-2 text-center text-sm text-coral">
          {errorMessage}
        </p>
      )}
      <TaskList
        tasks={tasks}
        mode="released"
        onRestoreTask={handleRestore}
        emptyMessage="Тут поки порожньо — жодної відпущеної задачі."
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the route**

```tsx
import { createClient } from "@/lib/supabase/server";
import { TrashView } from "@/components/gentle/trash-view";
import type { DbTask } from "@/types/gentle";

export default async function TrashPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .not("released_at", "is", null)
    .order("released_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-heading text-xl font-semibold">Кошик</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Задачі, які ти відпустив — вони чекають тут, якщо захочеш повернутись.
        </p>
      </div>
      <TrashView initialTasks={(tasks ?? []) as DbTask[]} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/trash-view.tsx "src/app/(app)/trash/page.tsx"`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/gentle/trash-view.tsx "src/app/(app)/trash/page.tsx"
git commit --no-gpg-sign -m "feat: add Кошик trash page"
```

---

## Task 11: Link to "Кошик" from the Inbox header

**Files:**
- Modify: `src/app/(app)/inbox/page.tsx`

**Interfaces:**
- Consumes: route `/trash` (Task 10).

- [ ] **Step 1: Add the header + link**

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

(Note the `.is("released_at", null)` here is the same Task 3 change —
this file is being fully replaced in this task since it also needs the
header markup, so the filter is included inline rather than as a
separate diff on top of Task 3's version.)

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "src/app/(app)/inbox/page.tsx"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/inbox/page.tsx"
git commit --no-gpg-sign -m "feat: link to Кошик from the inbox header"
```

---

## Task 12: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint`
Expected: no errors across the whole project.

- [ ] **Step 2: Confirm the migration is live**

Re-run the check from Task 1, Step 4, if it hasn't been confirmed yet in
this session:

```sql
select column_name from information_schema.columns
where table_name = 'tasks' and column_name = 'released_at';
```

Expected: one row. If missing, stop and apply
`supabase/migrations/0005_task_release.sql` before continuing — every
check below will fail against a live server otherwise.

- [ ] **Step 3: Start the dev server and load "Всі задачі"**

Use `preview_start` (per this project's tooling: `next dev` is
single-instance per directory — if it fails with "Another next dev server
is already running," check whether that's a different active session
before killing it). Navigate to `/inbox`, take a `preview_snapshot` to
confirm the "Всі задачі" heading and "Кошик" link are present.

- [ ] **Step 4: Simulate a swipe and confirm release**

Genuine touch-drag can't be produced by `preview_click`. Use
`preview_eval` to dispatch synthetic pointer events against the first
task card's `SwipeToRelease` wrapper (its outermost `div`, a sibling
structure one level above the card) — e.g.:

```js
(() => {
  const wrapper = document.querySelector('main [style*="touch-action"]');
  if (!wrapper) return "no swipeable card found";
  const rect = wrapper.getBoundingClientRect();
  const startX = rect.left + rect.width * 0.5;
  const y = rect.top + rect.height * 0.5;
  const fire = (type, x) =>
    wrapper.dispatchEvent(
      new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1 }),
    );
  fire("pointerdown", startX);
  fire("pointermove", startX - 40);
  fire("pointermove", startX - rect.width * 0.5);
  fire("pointerup", startX - rect.width * 0.5);
  return "dispatched";
})();
```

Expected: after ~700ms (`EXIT_MS` + `COLLAPSE_MS`), a `preview_screenshot`
shows the card gone and the "Пішло в безодню 🌊" toast visible at the
bottom with a "Скасувати" button. Check `preview_console_logs` for errors.

- [ ] **Step 5: Confirm undo**

`preview_click` the "Скасувати" button. Expected: the task reappears in
the list (via `preview_snapshot`), toast disappears.

- [ ] **Step 6: Confirm the trash page**

Repeat step 4's swipe (or swipe a different card) to release a task, let
the toast auto-dismiss (don't click undo this time), then navigate to
`/trash` via the "Кошик" link. Expected: the released task is listed with
a "Повернути" button, `mode="released"` styling (no checkbox, static
indicator instead). Click "Повернути" — expected: task disappears from
`/trash`, and reappears in `/inbox`.

- [ ] **Step 7: Confirm a completed task restores as completed**

In `/inbox`, mark any task complete via its checkbox, then swipe it away,
then restore it from `/trash`. Expected: it comes back checked
(`status: "completed"`), not reset to `todo` — this is the check that
validates the "no status juggling" data-model decision from the spec.

- [ ] **Step 8: Resize to mobile and re-check toast position**

`preview_resize` to the `mobile` preset, repeat step 4. Expected: the
toast sits fully above the `BottomNav`, not overlapping it. If it
overlaps, adjust `bottom-[84px]` in `release-toast.tsx` and re-check —
this was flagged as a live-tunable value in Task 7.

This task has no commit of its own (verification only) unless Step 8
required a fix, in which case:

```bash
git add src/components/gentle/release-toast.tsx
git commit --no-gpg-sign -m "fix: adjust release toast position above bottom nav"
```
