# Task Completion Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a short, rotating, encouraging toast whenever a task is checked off as done from a list view (Сьогодні, Незабаром, Всі задачі) — the plain-checkbox path currently gives zero feedback, unlike Focus mode's existing `CelebrationModal`.

**Architecture:** One new presentational component, `CompletionToast`, rendered the same way the existing `ReleaseToast` already is — from `TaskView` and `UpcomingView`, driven by local state in each. A pure helper, `pickCompletionPhrase`, picks a random phrase from a fixed pool while avoiding an immediate repeat. No server, schema, or route changes — this sits entirely on top of the already-working `toggleTaskComplete` action.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind v4 + `tw-animate-css` (already a project dependency, already used in `dialog.tsx`/`popover.tsx`).

## Global Constraints

- No new npm dependency — entrance animation uses `tw-animate-css` utility classes already available (`animate-in`, `fade-in-0`, `zoom-in-95`, per `src/components/ui/dialog.tsx`).
- Toast has **no button** — no undo, no dismiss action. It's a pure ambient nudge (per the locked design decision).
- Fires **only** when a task's *next* status is `"completed"` — never on un-checking (`"todo"`).
- Does **not** touch `FocusSessionModal`/`CelebrationModal` — that flow is separate and already works.
- This repo has no automated test runner (no `jest`/`vitest` in `package.json`). Verification in every task below is `npx tsc --noEmit`, `npx eslint`, and manual interaction via the `preview_*` tools.

---

## Task 1: `CompletionToast` component + phrase picker

**Files:**
- Create: `src/components/gentle/completion-toast.tsx`

**Interfaces:**
- Produces: `pickCompletionPhrase(lastPhrase: string | null): string` — returns a random phrase from a fixed pool, excluding `lastPhrase` if given. `CompletionToast({ toast: { key: number; message: string } | null })` — renders nothing when `toast` is `null`; otherwise renders a bottom toast, replaying its entrance animation whenever `toast.key` changes. Both are consumed by Tasks 2 and 3.

- [ ] **Step 1: Create the component**

```tsx
"use client";

const COMPLETION_PHRASES = [
  "Так тримати! 🌊",
  "Ще одна зроблена ✅",
  "Крок за кроком 🐚",
  "Це вже рахується 🐠",
  "Гарна робота 🌿",
  "Плюс одна перемога 🎉",
];

export function pickCompletionPhrase(lastPhrase: string | null): string {
  const pool = lastPhrase
    ? COMPLETION_PHRASES.filter((phrase) => phrase !== lastPhrase)
    : COMPLETION_PHRASES;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface CompletionToastProps {
  toast: { key: number; message: string } | null;
}

export function CompletionToast({ toast }: CompletionToastProps) {
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-40 mx-auto flex w-full max-w-md justify-center px-4">
      <div
        key={toast.key}
        className="animate-in fade-in-0 slide-in-from-bottom-3 zoom-in-95 rounded-full bg-sea-deep px-5 py-2.5 text-sm font-bold text-white shadow-lg duration-300"
      >
        {toast.message}
      </div>
    </div>
  );
}
```

The `key={toast.key}` on the inner (animated) `div` is what makes the
entrance animation replay on a rapid second completion — the parent bumps
`key` on every trigger, so React unmounts and remounts that node instead of
patching its text in place, which would skip the animation.

`pointer-events-none` on the wrapper keeps this purely ambient — it never
intercepts taps on the `BottomNav` or anything else underneath it, which
matters here specifically because (unlike `ReleaseToast`) there's no button
inside that needs clicks.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/completion-toast.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/gentle/completion-toast.tsx
git commit --no-gpg-sign -m "feat: add CompletionToast component"
```

---

## Task 2: Wire into `TaskView`

**Files:**
- Modify: `src/components/gentle/task-view.tsx`

**Interfaces:**
- Consumes: `CompletionToast`, `pickCompletionPhrase` (Task 1).

- [ ] **Step 1: Update imports**

Replace:

```tsx
import { useMemo, useState, useTransition } from "react";
```

with:

```tsx
import { useMemo, useRef, useState, useTransition } from "react";
```

Add, immediately after the existing `ReleaseToast` import:

```tsx
import { CompletionToast, pickCompletionPhrase } from "@/components/gentle/completion-toast";
```

- [ ] **Step 2: Add toast state and trigger it from `handleToggleComplete`**

Replace:

```tsx
  const handleToggleComplete = (task: DbTask) => {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    const removeOnComplete = isTodayTab && nextStatus === "completed";

    if (removeOnComplete) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } else {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    }
    setErrorMessage(null);
    startTransition(async () => {
      const result = await toggleTaskComplete(task.id, nextStatus);
      if ("error" in result) {
        if (removeOnComplete) {
          setTasks((prev) => [...prev, task]);
        } else {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
        }
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  };
```

with:

```tsx
  const [completion, setCompletion] = useState<{ key: number; message: string } | null>(null);
  const lastPhraseRef = useRef<string | null>(null);

  const handleToggleComplete = (task: DbTask) => {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    const removeOnComplete = isTodayTab && nextStatus === "completed";

    if (removeOnComplete) {
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } else {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    }
    setErrorMessage(null);
    if (nextStatus === "completed") {
      const message = pickCompletionPhrase(lastPhraseRef.current);
      lastPhraseRef.current = message;
      setCompletion((prev) => ({ key: (prev?.key ?? 0) + 1, message }));
    }
    startTransition(async () => {
      const result = await toggleTaskComplete(task.id, nextStatus);
      if ("error" in result) {
        if (removeOnComplete) {
          setTasks((prev) => [...prev, task]);
        } else {
          setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
        }
        setErrorMessage(result.error);
        setCompletion(null);
        return;
      }
      router.refresh();
    });
  };
```

Note the trigger is gated on `nextStatus === "completed"` alone — not on
`removeOnComplete` — so a completion on the Всі задачі tab (where the task
stays visible with a strikethrough instead of disappearing) still shows
the toast. `setCompletion(null)` in the error branch cancels the toast if
the server call actually failed and the optimistic update rolled back.

- [ ] **Step 3: Render the toast**

Replace:

```tsx
      <ReleaseToast
        task={releasedTask}
        onUndo={handleUndoRelease}
        onDismiss={() => setReleasedTask(null)}
      />
    </div>
  );
}
```

with:

```tsx
      <ReleaseToast
        task={releasedTask}
        onUndo={handleUndoRelease}
        onDismiss={() => setReleasedTask(null)}
      />
      <CompletionToast toast={completion} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/task-view.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/gentle/task-view.tsx
git commit --no-gpg-sign -m "feat: show completion toast when checking off a task in TaskView"
```

---

## Task 3: Wire into `UpcomingView`

**Files:**
- Modify: `src/components/gentle/upcoming-view.tsx`

**Interfaces:**
- Consumes: `CompletionToast`, `pickCompletionPhrase` (Task 1).

- [ ] **Step 1: Add the import**

`upcoming-view.tsx` already imports `useRef` (for `listTopRef`), so no
React import change is needed here. Add, immediately after the existing
`ReleaseToast` import:

```tsx
import { CompletionToast, pickCompletionPhrase } from "@/components/gentle/completion-toast";
```

- [ ] **Step 2: Add toast state and trigger it from `handleToggleComplete`**

Replace:

```tsx
  const handleToggleComplete = (task: DbTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await toggleTaskComplete(task.id, "completed");
      if ("error" in result) {
        setTasks((prev) => [...prev, task]);
        setErrorMessage(result.error);
        return;
      }
      router.refresh();
    });
  };
```

with:

```tsx
  const [completion, setCompletion] = useState<{ key: number; message: string } | null>(null);
  const lastPhraseRef = useRef<string | null>(null);

  const handleToggleComplete = (task: DbTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setErrorMessage(null);
    const message = pickCompletionPhrase(lastPhraseRef.current);
    lastPhraseRef.current = message;
    setCompletion((prev) => ({ key: (prev?.key ?? 0) + 1, message }));
    startTransition(async () => {
      const result = await toggleTaskComplete(task.id, "completed");
      if ("error" in result) {
        setTasks((prev) => [...prev, task]);
        setErrorMessage(result.error);
        setCompletion(null);
        return;
      }
      router.refresh();
    });
  };
```

This handler only ever completes (Незабаром's query already excludes
completed tasks — see the existing comment directly above this function),
so the trigger is unconditional here, unlike `TaskView`'s gated version.

- [ ] **Step 3: Render the toast**

Replace:

```tsx
      <ReleaseToast
        task={releasedTask}
        onUndo={handleUndoRelease}
        onDismiss={() => setReleasedTask(null)}
      />
    </div>
  );
}
```

with:

```tsx
      <ReleaseToast
        task={releasedTask}
        onUndo={handleUndoRelease}
        onDismiss={() => setReleasedTask(null)}
      />
      <CompletionToast toast={completion} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/gentle/upcoming-view.tsx`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/gentle/upcoming-view.tsx
git commit --no-gpg-sign -m "feat: show completion toast when checking off a task in UpcomingView"
```

---

## Task 4: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint`
Expected: no errors across the whole project.

- [ ] **Step 2: Check off a task in Сьогодні**

Use `preview_start` (reuse the running dev server if one already exists —
`next dev` is single-instance per directory in this project). Navigate to
`/today`, `preview_click` a task's checkbox. Expected: the task disappears
from the list, and a `preview_screenshot`/`preview_snapshot` right after
shows the toast pill near the bottom of the screen with one of the six
phrases. Check `preview_console_logs` for errors.

- [ ] **Step 3: Check off a task in Незабаром**

Navigate to `/upcoming`, `preview_click` a task's checkbox. Expected: same
toast behavior; the task disappears from the list (existing behavior,
unchanged).

- [ ] **Step 4: Check off a task in Всі задачі, and confirm un-checking is silent**

Navigate to `/inbox`, `preview_click` an incomplete task's checkbox.
Expected: toast appears; the task **stays** in the list with a
strikethrough (existing behavior, unchanged — this tab doesn't remove
completed tasks). Then `preview_click` the same checkbox again (unchecking
it). Expected: no new toast appears.

- [ ] **Step 5: Confirm rapid completions swap the message without stacking**

In `/inbox`, check off three different tasks in quick succession via
`preview_click`. Expected: only one toast element is ever present in the
DOM at a time (`preview_eval` a
`document.querySelectorAll('[class*="bg-sea-deep"]').length` check inside
the toast's fixed container returns `1`, not more), and its text changes
each time. Also confirm across ~8 completions that no two consecutive
toasts show identical text (read the phrase via `preview_snapshot` after
each click).

- [ ] **Step 6: Confirm the error-rollback path clears the toast**

There's no request-blocking tool available in this project's `preview_*`
toolset, so this step is a targeted code read rather than a live network
failure: open `src/components/gentle/task-view.tsx` and
`src/components/gentle/upcoming-view.tsx` and confirm both
`handleToggleComplete` functions call `setCompletion(null)` inside the
`if ("error" in result)` branch, alongside the existing task-list revert
and `setErrorMessage(result.error)` call. This is the same branch that
already reverts the optimistic task-list update and shows the coral error
banner — it already runs on any real `toggleTaskComplete` failure — so
the reviewer only needs to confirm the new line is actually present in
both files, not exercise a live failure.

- [ ] **Step 7: Resize to mobile and re-check toast position**

`preview_resize` to the `mobile` preset, repeat Step 2. Expected: the
toast sits fully above `BottomNav`, not overlapping it — same
`bottom-[84px]` value already proven correct for `ReleaseToast` in this
exact spot.

This task has no commit of its own (verification only) unless Step 6
uncovers a real overlap, in which case:

```bash
git add src/components/gentle/completion-toast.tsx
git commit --no-gpg-sign -m "fix: adjust completion toast position above bottom nav"
```
