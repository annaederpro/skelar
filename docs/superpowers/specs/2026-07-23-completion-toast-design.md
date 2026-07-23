# Task completion toast — design spec

## Context

Checking off a task's checkbox on `TaskCard` (`src/components/gentle/task-card.tsx`)
already works — `TaskView`/`UpcomingView` call `toggleTaskComplete` and update
local state — but produces no feedback of its own. The task either
disappears from the list (Сьогодні, Незабаром) or gets a strikethrough in
place (Всі задачі), and that's it. The one place coralQ *does* celebrate a
finished task is `FocusSessionModal` → `CelebrationModal` (fish/turtle/egg,
`src/components/gentle/celebration-modal.tsx`), which only fires at the end
of a Focus session. The everyday checkbox path — the far more common way
tasks get completed — has a gap.

This spec adds a lightweight, non-blocking toast that appears whenever a
task is checked off as done from any list view, independent of the
Focus-mode celebration flow (which is untouched).

## Decisions locked with the user before writing this spec

- **Trigger surface**: the plain checkbox in list views only (Сьогодні,
  Незабаром, Всі задачі) — i.e. `TaskView` and `UpcomingView`'s
  `handleToggleComplete`. The Focus-mode `CelebrationModal` flow is a
  separate, already-working path and is not touched.
- **Format**: a lightweight bottom toast (not a modal, not a card-local
  animation) — same visual slot as the existing `ReleaseToast`, but styled
  and worded for a positive moment rather than `ReleaseToast`'s neutral/
  compassionate one.
- **Copy**: a pool of ~6 short rotating phrases (not one fixed line) —
  this fires on every checkbox tap, so a single repeated phrase would wear
  thin fast.
- **Undo**: none. No **Скасувати** button in this toast. Completion is
  already reversible by re-opening "Всі задачі" and unchecking the box, so
  the toast can stay purely a positive nudge with zero interactive surface.

## Non-goals (this pass)

- Any change to `FocusSessionModal` / `CelebrationModal` — that flow
  already gives feedback and is out of scope.
- An undo action from the toast itself (see Decisions above).
- Triggering on un-checking a task (`nextStatus === "todo"`) — only firing
  on the forward completion action.
- New sound, haptic, or confetti-particle effects — entrance animation
  only, using the animation utilities already in the project
  (`tw-animate-css`, already imported in `globals.css`). No new dependency.
- Any change to `project-filter-bar.tsx`'s "Виконано" filter or the
  underlying `toggleTaskComplete` server action — this is purely an
  additive client-side feedback layer on top of the existing, working
  toggle.

## New component: `CompletionToast`

New file, `src/components/gentle/completion-toast.tsx`, structurally a
sibling to `ReleaseToast` (`src/components/gentle/release-toast.tsx`):
same fixed position (`fixed inset-x-0 bottom-[84px]`, above `BottomNav`),
same auto-dismiss-via-`setTimeout` mechanism. Two differences in kind:

- **Tone/styling**: warm/positive rather than `ReleaseToast`'s neutral
  `bg-ink`. Uses the sea-positive palette already established for good
  news elsewhere in the app (`CelebrationModal`'s `bg-sea-soft`/
  `text-sea-deep` tag, `FocusCard`'s `from-sea to-sea-deep` gradient,
  add-task-dialog's `bg-sea-deep` success pill) — e.g. `bg-sea-deep`
  background, white text. This makes the two toasts read as opposite
  emotional registers at a glance without needing to read the copy.
- **No action button** — just the message, per the Undo decision above.

```ts
interface CompletionToastProps {
  message: string | null; // null = hidden
}
```

Ownership of *when* it's visible and *what* it says lives in the parent
(`TaskView`/`UpcomingView`), matching how `ReleaseToast` is driven by
`releasedTask` state in those same parents rather than managing its own
visibility.

### Copy pool

A fixed array of short phrases in the existing brand voice (warm, a little
playful, ocean-themed emoji — matching `ReleaseToast`'s and
`CelebrationModal`'s register):

```ts
const COMPLETION_PHRASES = [
  "Так тримати! 🌊",
  "Ще одна зроблена ✅",
  "Крок за кроком 🐚",
  "Це вже рахується 🐠",
  "Гарна робота 🌿",
  "Плюс одна перемога 🎉",
];
```

Picked at random on each trigger, excluding whichever phrase was shown last
(simple `filter` + random index, falling back to the full pool if only one
phrase remains — trivially true here since the pool has 6 entries) so two
completions in a row never repeat the same line.

### Animation

Entrance only, via `tw-animate-css` utility classes already used elsewhere
in the project (`dialog.tsx`, `popover.tsx`):
`animate-in fade-in-0 slide-in-from-bottom-3 zoom-in-95 duration-300`.
No exit animation — it disappears on unmount, same as `ReleaseToast` and
the add-task success pill today.

If a second completion happens while the toast is still showing (rapid
checkbox taps), the message swaps and the animation replays. This is done
by keying the inner animated element on a monotonically increasing counter
(bumped every trigger), so React remounts the node and the `animate-in`
classes re-run, rather than stacking multiple toasts.

## Wiring: `TaskView` and `UpcomingView`

Both components already have a `handleToggleComplete(task)` with an
optimistic-update-then-revert shape. Each gains:

```ts
const [completion, setCompletion] = useState<{ key: number; message: string } | null>(null);
const lastPhraseRef = useRef<string | null>(null);

function triggerCompletionToast() {
  const pool = COMPLETION_PHRASES.filter((p) => p !== lastPhraseRef.current);
  const message = pool[Math.floor(Math.random() * pool.length)];
  lastPhraseRef.current = message;
  setCompletion((prev) => ({ key: (prev?.key ?? 0) + 1, message }));
}
```

- **`TaskView.handleToggleComplete`**: call `triggerCompletionToast()`
  immediately after the optimistic state update, gated on
  `nextStatus === "completed"` (the existing `removeOnComplete` local
  already captures "is this a completion", but note it's `isTodayTab &&
  nextStatus === "completed"` — the toast trigger needs its own
  `nextStatus === "completed"` check, independent of tab, since Всі задачі
  completions should also celebrate even though the task doesn't leave the
  list there).
- **`UpcomingView.handleToggleComplete`**: this handler only ever completes
  (Незабаром's query already excludes completed tasks — see the existing
  comment above the handler), so call `triggerCompletionToast()`
  unconditionally at the top of the optimistic branch.
- **Rollback on error**: in the `if ("error" in result)` branch of both
  handlers, also `setCompletion(null)` — if the server call actually
  failed and the task reverts to its prior state, the toast shouldn't be
  left celebrating a completion that didn't stick.

Render `<CompletionToast key={completion?.key} message={completion?.message ?? null} />`
alongside the existing `<ReleaseToast .../>` in both components' JSX.

## Error handling

| Case | Behavior |
|---|---|
| `toggleTaskComplete` succeeds | Toast shows a random (non-repeating) phrase, auto-dismisses after ~2.5s |
| `toggleTaskComplete` fails | Toast is cleared immediately (see Rollback above); existing coral error banner still shows, as it does today |
| Un-checking a completed task (Всі задачі) | No toast — trigger is gated on `nextStatus === "completed"` |
| Rapid successive completions | Message swaps and animation replays each time; toasts never stack |
| A release and a completion toast become visible at the same moment | Both render in the same fixed slot and would visually overlap — accepted as a rare, short-lived edge case (see Self-authored decisions) |

## Testing

No test runner in this repo (existing project convention — manual
verification):

1. Check off a task in Сьогодні → toast appears with a phrase, task
   disappears from the list, toast auto-dismisses ~2.5s later.
2. Check off a task in Незабаром → same toast behavior; task disappears
   from the list (existing behavior, unchanged).
3. Check off a task in Всі задачі → toast appears; task stays in the list
   with strikethrough (existing behavior, unchanged).
4. Un-check a completed task in Всі задачі → no toast appears.
5. Check off several tasks back-to-back within ~1s of each other → toast
   message updates each time and the entrance animation visibly replays,
   never showing two toasts stacked.
6. Check off ~8 tasks in a row → confirm no two consecutive toasts show
   the same phrase.
7. Simulate a failed `toggleTaskComplete` (e.g. temporarily throw in the
   action, or use devtools to force a network failure) → toast does not
   appear (or disappears immediately), coral error banner shows, task
   reverts — matching existing error-path behavior for the rest of the
   list.
8. Live-verify via `preview_*` tools on both desktop and a mobile viewport
   (`preview_resize`) — the toast sits above `BottomNav` without overlap.

## Self-authored decisions (assumptions — user may veto at spec review)

- `CompletionToast` is a new component rather than extending `ReleaseToast`
  with a "kind" prop — the two have different content shape (button vs.
  no button, single line vs. lead+body) and diverging them now keeps each
  simple, per the existing `ReleaseToast`/`CelebrationModal` split in this
  codebase (small single-purpose components over parameterized ones).
- Overlap between `ReleaseToast` and `CompletionToast` (releasing one task
  right as another's completion toast is showing) is left unhandled —
  both are short-lived, auto-dismissing, and the scenario requires two
  fast actions on different tasks in immediate succession. Worth revisiting
  only if it turns out to happen often in practice.
- The phrase pool is a plain hardcoded array colocated in
  `completion-toast.tsx`, not pulled into a shared copy/constants file —
  matches how `ReleaseToast`'s copy and `CelebrationModal`'s `CONTENT`
  record are already inlined in their own files rather than centralized.
- Toast duration: ~2.5s (matching the add-task-dialog success pill's
  2600ms), shorter than `ReleaseToast`'s 5s — this toast carries no action
  to give the user time to take, just an ambient nudge, so it can clear
  faster.
