# Hide done tasks + confirm task removal in "Всі задачі"

## Context

"Всі задачі" (`/inbox`) already has a "Виконані" filter chip that toggles
between showing all tasks and isolating only completed ones
(`StatusFilter: "all" | "completed"` in
`src/components/gentle/project-filter-bar.tsx`). There's no way to hide
completed tasks while keeping active ones visible.

Separately, removing a crossed-out task from the list already works: every
row in `/inbox` is wrapped in `SwipeToRelease`, regardless of completion
status, and `handleRelease`/`releaseTask` in `task-view.tsx` sends any task
to "Кошик" (trash), from which it's restorable. This needs live
verification, not new code.

## Design

### 1. Three-state "Виконані" chip

Extend `StatusFilter` (`project-filter-bar.tsx`) from `"all" | "completed"`
to `"all" | "completed" | "active"`. Tapping the chip cycles:
all → completed → active → all.

- `all`: label "Виконані", outline/unselected style (unchanged)
- `completed`: label "Виконані", filled/selected style, check icon
  (unchanged behavior — isolates completed tasks)
- `active` (new): label "Без виконаних", filled/selected style, eye-off
  icon — filters completed tasks out, keeps active ones

No persistence — resets to "all" on next page load, consistent with every
other filter chip in the app (no localStorage/DB-backed UI toggle exists
anywhere currently).

### Files touched

- `src/components/gentle/project-filter-bar.tsx` — `StatusFilter` type,
  chip cycle click handler, label/icon per state
- `src/components/gentle/task-view.tsx` — add a `statusFilter === "active"`
  branch to the `visibleTasks` filter (excludes `status === "completed"`);
  add an empty-state message for when hiding completed leaves nothing to
  show (e.g. "Усі задачі виконано 🌿")

### 2. Verify swipe-to-remove already works on completed tasks

No new code expected. Verify in the live preview that swiping a
crossed-out task on `/inbox` sends it to "Кошик" and it can be restored
from there. Fix only if something is actually broken.

## Testing

- Manual verification via preview: cycle through all three chip states
  with a mix of done/not-done tasks; confirm filtering and empty-state
  copy are correct in each state.
- Manual verification via preview: swipe a completed task, confirm it
  disappears from "Всі задачі" and shows up in "Кошик", and restores
  correctly.
