# Task Release ("Відпустити в океан" / The Abyss) — design spec

## Context

coralQ has no way to delete a task today. `deleteProject` exists
(`src/app/actions.ts`), but nothing analogous exists for `tasks` — `TaskCard`
only wires up `onToggleComplete` (the checkbox) and `onEdit` (click-to-open
`EditTaskDialog`). A task that's wrong, stale, or no longer wanted has no
way to leave the list except being marked complete, which is dishonest and,
per the product ask, a source of background guilt for tasks that have sat
untouched for weeks.

This spec adds a soft-delete "release" action, framed through the app's
existing ocean/aquarium metaphor (fish for completed tasks, eggs for
in-progress Focus sessions — see `celebration-modal.tsx`): letting go of a
task sends it into "Безодня" (the Abyss/trash), recoverable at any time, with
a compassionate message instead of a confirmation dialog.

## Decisions locked with the user before writing this spec

- **Trigger**: full swipe on a `TaskCard` in any task list (Сьогодні,
  Незабаром, Всі задачі, project pages) — one continuous gesture, no
  secondary confirm tap.
- **Immediacy**: the swipe releases the task instantly (no confirmation
  dialog). Safety comes from two recovery paths instead: an undo toast
  right after, and a permanent "Безодня" trash view.
- **Undo**: a toast appears after release with the app's thank-you copy and
  an **Скасувати** (Undo) button, auto-dismissing after ~5s. Undo calls the
  *same* restore action the trash page uses — one restore path, not two.
- **Trash location**: not a 5th bottom-nav tab (already at 4, and mobile
  vertical space is already tight — see `672a174`). A small link from the
  "Всі задачі" (Inbox) page header instead, at its own route so it isn't
  bottom-nav-gated.
- **Copy** (fixed by the user): *"Це нормально — змінювати плани. Ти
  звільнив місце для чогось важливішого."*

## Non-goals (this pass)

- Hard/permanent delete. Released tasks stay in "Безодня" indefinitely —
  no auto-purge job, no "empty trash" button. (Cheap to add later; not
  asked for.)
- Any change to `deleteProject` or project-level deletion.
- Swipe-to-restore inside the trash — restoring is a deliberate action
  (tap **Повернути**), not a gesture, so it isn't symmetric with (and can't
  be mistaken for) the release swipe.
- Releasing directly from `EditTaskDialog` or `FocusSessionModal` — only
  the swipe entry point, per the locked decision above.
- Any new gesture/animation dependency. No gesture library is in
  `package.json` (checked) and the project's existing pattern (see
  `ocean-noise.ts`'s comment about avoiding an audio asset) favors
  zero-dependency, hand-rolled solutions where practical. Swipe tracking
  uses plain pointer events; the bubble/glow release animation is CSS
  keyframes, adapted from the existing `.aq-bubble` animation already
  defined in `aquarium-tank.tsx`.

## Data model

One nullable column, no enum changes — `status` (`todo` | `completed`)
stays exactly as-is, so restoring a task can never lose or need to guess
its prior state:

```sql
-- 0005_task_release.sql
alter table public.tasks add column released_at timestamptz;
create index if not exists tasks_released_at_idx on public.tasks(released_at);
```

No RLS changes: release/restore are plain `update`s on a row the user
already owns, covered by the existing "Users can update own tasks" policy.
Reading released tasks for the trash view is covered by the existing
"Users can view own tasks" select policy.

`DbTask` (`src/types/gentle.ts`) gains `released_at: string | null`.

## Query updates

Every existing task fetch needs `.is("released_at", null)` added, the same
way `status`/`is_seeded` filters already scope these queries:

| File | Query |
|---|---|
| `src/app/(app)/today/page.tsx` | today's tasks |
| `src/app/(app)/upcoming/page.tsx` | upcoming tasks |
| `src/app/(app)/inbox/page.tsx` | all tasks |
| `src/app/(app)/browse/[projectId]/page.tsx` | project tasks |
| `src/app/(app)/aquarium/page.tsx` | both queries (swimmer count + eggs) |
| `src/app/(app)/layout.tsx` | both queries (Focus pool + today count) |

The new "Безодня" page queries the inverse: `.not("released_at", "is", null)`.

`insertTaskForUser` (`src/lib/tasks/insert-task.ts`) needs no change —
new tasks are never created with `released_at` set.

## Server actions

Added to `src/app/actions.ts`, mirroring `toggleTaskComplete`'s shape
(auth check via cookie session, relies on RLS rather than an explicit
`user_id` filter, generic `"Не вдалося оновити задачу."` error string):

```ts
export async function releaseTask(taskId: string): Promise<{ ok: true } | { error: string }> {
  // same auth guard as toggleTaskComplete
  const { error } = await supabase
    .from("tasks")
    .update({ released_at: new Date().toISOString() })
    .eq("id", taskId);
  // same error handling
}

export async function restoreTask(taskId: string): Promise<{ ok: true } | { error: string }> {
  // same auth guard
  const { error } = await supabase
    .from("tasks")
    .update({ released_at: null })
    .eq("id", taskId);
  // same error handling
}
```

## UI: swipe + release animation

**`SwipeToRelease`** — new client component, `src/components/gentle/swipe-to-release.tsx`,
wrapping a single `TaskCard` (used inside `TaskList`, not the trash list):

- Tracks a horizontal drag via `onPointerDown`/`onPointerMove`/`onPointerUp`
  on a wrapper div; translates the card with `transform: translateX()`
  during the drag (no library — same primitive-CSS approach the rest of
  the app already uses, e.g. `focus-session-modal.tsx`'s hand-rolled ring
  timer).
- Crossing a distance threshold (a fraction of the card's own width, so it
  scales with card/viewport size rather than a fixed pixel count) on
  release commits to the swipe; anything short of that springs back to
  `translateX(0)` via a CSS transition.
- On commit: plays a ~400–500ms release animation in place of the card —
  bubbles rising (reusing the `.aq-bubble` keyframe from
  `aquarium-tank.tsx`) over a soft teal glow, then the row's height
  collapses to 0 — and fires an `onRelease` callback.
- Purely presentational/gestural. It doesn't call the server action or
  touch task state itself — that stays in `TaskView`, matching how
  `TaskList` already stays presentational and pushes state changes up via
  callbacks (`onToggleComplete`, `onEditTask`).

**`TaskView`** (`src/components/gentle/task-view.tsx`) gains a
`handleRelease(task)`, following the exact optimistic-update-then-revert
shape `handleToggleComplete` already uses:

1. Optimistically remove the task from local `tasks` state.
2. `startTransition(async () => { const result = await releaseTask(task.id); ... })`.
3. On error: re-insert the task into state (at its original index — same
   list, order matters less here than for a status flip, but avoids a
   surprising jump if the append order looked odd) and surface the
   existing coral error banner.
4. On success: show the undo toast for this task (see below) and
   `router.refresh()`.

## UI: undo toast

New component, `src/components/gentle/release-toast.tsx` — a single-slot
toast (only one release can be "pending undo" at a time; releasing a second
task while one toast is showing replaces it, matching the single-task
undo the feature was asked for). Rendered from `TaskView`, positioned as a
fixed bar above `BottomNav`.

- Content: the fixed copy — *"Це нормально — змінювати плани. Ти звільнив
  місце для чогось важливішого."* — plus **Скасувати**.
- Auto-dismisses after 5s (a `setTimeout`, cleared on unmount/replacement).
- **Скасувати** calls `restoreTask(taskId)`, then `router.refresh()` and
  clears the toast. This is the exact same call the trash page's
  **Повернути** button makes — no separate "undo" code path.
- After the toast dismisses (timeout or explicit undo), the task is not
  gone forever either way — it's simply in "Безодня" until manually
  restored from there.

## UI: "Безодня" (trash) page

New route, `src/app/(app)/trash/page.tsx` — outside the bottom nav, linked
via a small icon button in the "Всі задачі" inbox page's header (next to
existing header content in `inbox/page.tsx`/`task-view.tsx`).

- Fetches tasks where `released_at is not null`, ordered by `released_at`
  descending (most recently let go first).
- Renders via `TaskList`/`TaskCard` in a new `variant="released"` mode:
  checkbox replaced by a static "released" indicator, click-to-edit
  disabled (must be restored before it's editable again — editing a
  released task isn't a supported state), and a **Повернути** button that
  calls `restoreTask` directly (no swipe here — see Non-goals).
- Empty state copy in the same voice as other empty states (e.g. inbox's
  "Всі задачі порожні. Гарний знак 🌿"): something like *"Тут поки
  порожньо — жодної відпущеної задачі."*
- Page title "Безодня", subtitle explaining what it is (e.g. "Задачі, які
  ти відпустив — вони чекають тут, якщо захочеш повернутись").

## Error handling

| Failure | Behavior |
|---|---|
| `releaseTask` fails (network/DB) | Task reappears in its list, coral error banner (existing `TaskView` pattern) |
| `restoreTask` fails (from toast or trash) | Toast/trash row stays as-is, coral error banner |
| Swipe released short of the threshold | Card springs back, no server call |
| Releasing a second task while a toast is showing | New toast replaces the old one; the first task is still released (not undoable via toast anymore, but still recoverable from Безодня) |
| User closes/reloads the tab before the toast times out | No effect — `released_at` was already persisted on release, not on toast expiry |

## Testing

No test runner in this repo (existing project convention — manual
verification, as in the other specs under `docs/superpowers/specs/`):

1. Swipe a task fully in "Всі задачі" → card animates (bubbles/glow) and
   collapses, toast appears, task gone from Сьогодні/Незабаром/Inbox/
   Aquarium's Focus pool.
2. Tap **Скасувати** within 5s → task reappears in its original list.
3. Let the toast expire, then open "Безодня" → task is listed; tap
   **Повернути** → task reappears in its original list, "Безодня" no
   longer shows it.
4. Release a `completed` task → restore it → confirm it comes back
   *completed*, not reset to `todo` (validates the "no status juggling"
   data-model choice).
5. Release an `is_seeded` (egg) task → restore it → confirm `is_seeded` is
   unchanged (this spec doesn't touch it either way).
6. Partial swipe (short of threshold) → card springs back, no network call
   (check via devtools that no `releaseTask` request fired).
7. Live-verify on a real mobile viewport via `preview_resize`/touch
   emulation — swipe gestures need actual pointer-event behavior checked,
   not just a desktop mouse drag.

## Self-authored decisions (assumptions — user may veto at spec review)

- Swipe direction: left (matches the near-universal "swipe left to
  remove/archive" convention from Mail/Gmail-style apps).
- Swipe threshold: distance-based (fraction of card width) rather than
  velocity-based fling detection — simpler to implement correctly with
  plain pointer events, and this is a deliberate "let go" gesture rather
  than a flick-heavy interaction.
- The release animation is card-local (plays where the card already is in
  the list), not a full-screen modal like `CelebrationModal` — releasing a
  task is a lighter, quieter action than finishing a Focus session, and a
  blocking modal would work against the "no friction" intent.
- "Безодня" is reachable only via a header link from Inbox, not from
  Today/Upcoming/project pages too — keeps it to one discoverable place
  rather than repeating the link everywhere.
- `TaskCard`'s new `variant="released"` mode is a prop addition to the
  existing component (not a separate component) — the card's visual
  vocabulary (priority pill, effort dots, due date) is unchanged in the
  trash, only the action affordance at the interaction layer changes.
