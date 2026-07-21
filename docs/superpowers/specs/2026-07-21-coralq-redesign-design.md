# coralQ redesign — full design spec

## Context

A full product pivot from "Gentle Productivity" (pastel Todoist-style task
manager, shipped as sub-projects 1–2) to **coralQ**: an ocean-themed gentle
productivity app whose signature ideas are (1) a **Focus** module that
suggests one task matched to your time + energy and runs a no-pressure
focus session, and (2) an **Aquarium** where completing tasks populates a
living reef with creatures. Source of truth for the visual + interaction
design is the mockup `coralq-mvp.html` (provided by the user).

The backend from sub-projects 1–2 is **kept**: Supabase auth, the
`users`/`tasks`/`projects` tables, Server Actions, middleware, the `(app)`
route group, resource-status Context. This redesign is overwhelmingly a
**frontend reskin + new frontend features**, plus two tiny additive schema
changes.

Decisions locked with the user before writing this spec:
- **coralQ is the committed direction** — rework the real Next.js app, full
  rebrand, not a throwaway prototype.
- **Aquarium v1 is cosmetic / client-side** — fish/celebrations are visual;
  creature counts derive from the real count of completed tasks; no separate
  aquarium/collection/streak DB tables in v1.

## Build phasing

One coherent design (this doc), built as three sequential, independently
shippable phases — each gets its own implementation plan + subagent build:

- **Phase 1 — Design system + rebrand + reskin.** Ocean palette, Fraunces +
  Nunito Sans fonts, "Gentle Productivity" → "coralQ" everywhere, restyle
  every existing screen/component to the mockup (task cards with effort
  dots + 3-label priority, mood selector, bottom nav with Aquarium slot,
  filters row, login, dialogs). No new features — the app does exactly what
  it does today, wearing coralQ's skin.
- **Phase 2 — Focus module.** The "Фокус зараз" card (pick free time → one
  suggested task by time+energy → focus session modal with a growing ring)
  and the three celebration modals (finish → new fish; finish a seeded task
  → "egg grew"; exit-without-pressure → "you left an egg"). Adds the
  `tasks.is_seeded` column.
- **Phase 3 — Aquarium tab.** The 4th nav destination: creature-of-the-day
  card on Today, the aquarium view (swimming-fish SVG animations, stats,
  species collection grid with locked/unlocked cells), all cosmetic/derived.

## Self-authored decisions (assumptions — user may veto at spec review)

1. **Bottom nav = Вхідні / Сьогодні / Незабаром / Акваріум** (matching the
   mockup). The Browse/projects feature shipped in sub-project 2 is NOT
   deleted — `/browse` and `/browse/[projectId]` routes remain, tasks keep
   `project_id`, the add-task form keeps its project picker — but Browse
   loses its bottom-nav tab (Aquarium takes that 4th slot). Projects stay
   reachable by URL; a nav entry point can be re-added later if wanted. This
   preserves shipped work without contradicting the mockup.
2. **Priority stays `smallint` 1–4 in the DB; the UI presents 3 human
   labels.** No migration. Mapping: DB `1` → **Важливо** (coral/high), DB
   `2`–`3` → **Звичайне** (mid/grey), DB `4` → **Колись** (low/muted-sage).
   When the user cycles priority on a card, it moves through the three
   buckets writing back a representative DB value (1 / 2 / 4). The Priority
   TS type and `PRIORITY_LABEL`/`PRIORITY_DOT_CLASS` maps are reworked to
   this 3-bucket presentation.
3. **`tasks.is_seeded boolean not null default false`** is added (migration
   0003) — one column on the existing table, not a new table, consistent
   with the "no separate tables" instruction. It records that a task was
   started via Focus but exited without pressure ("egg left"). This is core
   Focus UX and cheap to persist; keeping it client-only would lose the
   "come back when you have resource" thread on reload.
4. **Energy stays `energy_level` 1–3** (unchanged schema). The mockup's
   "effort dots" (легка/середня/глибока) and the mood selector (Мало сил /
   В нормі / Повний заряд) both render this same 1–3 value — mood selector
   drives the same `current_resource_status` we already persist, remapped to
   coralQ's labels/colors.
5. **Aquarium creature count = count of completed tasks** (derived server- or
   client-side from existing data). Streak ("днів поспіль") and species
   unlocks in v1 are **presentational placeholders** driven by simple
   derived numbers (e.g. distinct completion days), NOT persisted
   achievement state. Flagged clearly so Phase 3 doesn't over-build.
6. **The Focus suggestion is the original spec's "Smart Rescue"**, realized:
   filter tasks by `energy_level <= currentEnergy` and `duration_minutes <=
   chosenMinutes`, sort by priority then shortest, show one, "Інша" cycles
   the pool. Reuses existing task data; no new backend.

## Visual design system (Phase 1 foundation)

Extracted verbatim from `coralq-mvp.html`:

**Palette (CSS custom properties / Tailwind tokens):**
```
--paper:#F1F6F4  --card:#FFFFFF  --ink:#31403E  --ink-soft:#6E827F
--sea:#3E8E9C    --sea-deep:#2E6E7A  --sea-soft:#E1F0F1
--sand:#E7D9BC   --sand-soft:#F5EEDD
--coral:#DF8464  --coral-soft:#FBE7DE
--anem:#B98AC0   --anem-soft:#F0E9F3   (anemone / high-energy accent)
--line:#E4ECE9
shadow: 0 8px 28px rgba(46,63,61,.1); shadow-sm: 0 2px 10px rgba(46,63,61,.06)
```
Page background: layered radial gradients in `#DFF0F0`/`#EAF2EC` over
`#DEE9E6`.

**Type:** Fraunces (serif) for headings/wordmark/numbers; Nunito Sans
(sans) for body. Loaded via `next/font/google` (replacing the current Geist
fonts). Fraunces weights 400/500/600; Nunito Sans 400/500/600/700.

**Semantic mapping to existing tokens:** `--sea` becomes the primary
(replacing rose-400 as the accent/FAB/active-nav color); `--coral` is the
high-priority/attention accent (replacing the old rose for P1); soft
error/depleted states use `--coral-soft`; success/growth uses `--sea`.
The "no hard red" gentle constraint from earlier is naturally satisfied —
the whole palette is soft ocean tones.

**Component restyle checklist (Phase 1):**
- Wordmark: "coral" + a small coral-and-circle SVG glyph (from mockup),
  replacing "Gentle Productivity" text in `AppShell` header, `login/page`,
  and `layout` metadata `title`.
- **Task card**: white rounded-20 card, left 4px color bar (coral for high
  priority; sea for a seeded/egg task), circular check (fills sea when
  done), task name, priority pill (3-label), meta row = `🕐 {min} хв` +
  effort dots (1–3 filled sea dots + word) + optional `🥚 ікринка` when
  seeded. `TaskCard` is rewritten; `TaskList` unchanged in contract.
- **Mood selector**: 3-column grid of cards (Мало сил / В нормі / Повний
  заряд), pressed state tints coral-soft / sea-soft / anem-soft — drives the
  same resource-status update we already have.
- **Filters row**: horizontally scrollable chips (Усі / ⚑ Важливе / ≤15 хв /
  Під мою енергію) — client-side filters over the current task list.
- **Bottom nav**: 4 tabs with new icons + `--sea-deep` active color; badge
  on Today stays.
- **Dialogs / buttons / inputs**: restyle to ocean tokens (rounded, soft
  shadows, sea primary buttons).

## Error handling / gentle tone

Unchanged conventions: Server Actions return `{ error }` with soft
Ukrainian copy; no hard-red alerts (the ocean palette has no alert-red at
all). Celebration and empty-state copy is warm and pressure-free, matching
the mockup's voice ("Пишаюся тобою", "це рахується", "без поспіху").

## Phase 2 addendum (added mid-build, per user request)

- **Ocean white-noise toggle inside the focus session.** Synthesized
  client-side via the Web Audio API (filtered noise buffer through a
  low-pass filter + slow gain LFO for a wave-swell feel) — no external
  audio asset to source/license/host. A speaker-icon toggle button in the
  session modal starts/stops it; audio always stops when the session
  closes (finish, exit, or escape/backdrop).
- **Focus card placement: `AppShell`, not per-route.** The mockup only had
  one list screen so placement was moot; our app has four (`/inbox`,
  `/today`, `/upcoming`, `/browse/*`). Scoping the suggestion pool to
  whichever route's already-filtered query happens to be active would
  silently hide project-assigned or future-dated tasks from Focus. Instead
  `(app)/layout.tsx` fetches the user's full set of non-completed tasks
  once and `AppShell` renders `FocusCard` (below the mood selector, above
  routed `children`) on every screen, consistent with Focus being a
  cross-cutting "what should I do right now" action, not a per-list one.
- **Session timer counts up in real time** (the mockup's 20×-speed timer
  was a preview-only convenience, not the intended production behavior).
- **Backdrop click / Escape closes the session silently** (no completion,
  no "egg" state change) — only the two explicit buttons ("Завершити" /
  "Вийти без тиску") mutate task state, matching the mockup's actual
  button semantics.

## Out of scope (v1)

- Persisted aquarium achievements: real streak tracking, per-species unlock
  records, creature inventory tables (Phase 3 uses derived/placeholder
  numbers).
- Real audio/haptics on celebration.
- Reworking the projects feature beyond dropping its nav tab.
- Telegram bot, Gemini task parsing (later blocks of the original roadmap).
- Light/dark theming beyond the single coralQ light theme.

## Verification approach

Same as prior sub-projects: `npx tsc --noEmit` + `npm run lint` clean after
every task, plus live browser verification by the controller against the
real Supabase project (auth, task CRUD, focus flow, celebrations, aquarium
render). Each phase ends with an end-to-end pass before the next begins.
