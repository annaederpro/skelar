# coralQ Phase 1 — Design system + rebrand + reskin (execution notes)

> Executed controller-directly with live browser verification per chunk
> (not subagent-dispatched): a reskin against a precise mockup is gated by
> visual correctness, which the controller verifies in the preview browser.
> Source of truth for exact styles: the user's `coralq-mvp.html` mockup.

**Goal:** The existing real app does exactly what it does today, wearing
coralQ's ocean skin. No new features (Focus = Phase 2, Aquarium = Phase 3).

## Chunks (each: implement → `tsc`/`lint` → browser-verify → commit)

1. **Design tokens + fonts.** `src/app/globals.css`: repoint shadcn semantic
   tokens (`--background`/`--foreground`/`--primary`/`--muted`/`--border`/
   `--destructive`/`--accent`/`--ring`…) to the coralQ ocean palette, and add
   coralQ tokens (`--sea`, `--sea-deep`, `--sea-soft`, `--coral`,
   `--coral-soft`, `--anem`, `--anem-soft`, `--sand`, `--ink-soft`, `--line`,
   `--paper`) into `@theme` so `bg-sea`/`text-ink-soft` etc. exist. Layered
   radial-gradient page background. `src/app/layout.tsx`: swap Geist for
   Fraunces (heading) + Nunito Sans (body) via `next/font/google`; wire
   `--font-sans`→Nunito, `--font-heading`→Fraunces; update metadata title to
   "coralQ".
2. **Wordmark + rebrand strings.** coralQ wordmark (text + coral SVG glyph)
   component; use in `AppShell` header + `login/page`. Replace all
   "Gentle Productivity" copy.
3. **Priority 3-label remap.** `src/types/gentle.ts`: rework
   `PRIORITY_LABEL`/`PRIORITY_DOT_CLASS` to the 3-bucket presentation
   (Важливо/Звичайне/Колись; DB 1 / 2 / 4). Add helper to map any stored
   1–4 → bucket. No migration.
4. **Task card reskin.** `src/components/gentle/task-card.tsx`: ocean card,
   left color bar (coral=high, sea=seeded later), circular sea check, 3-label
   priority pill, meta row with effort dots + `хв`. (`is_seeded`/egg tag is
   Phase 2 — leave a no-op hook.)
5. **Mood selector reskin.** Replace `resource-status-toggle.tsx`'s pill row
   with the 3-card mood grid (Мало сил / В нормі / Повний заряд) tinting
   coral-soft/sea-soft/anem-soft; still drives `updateResourceStatus`.
6. **Bottom nav + shell + banner + dialogs.** `bottom-nav.tsx` (4 tabs, 4th =
   Акваріум placeholder route, sea-deep active), `app-shell.tsx` layout to
   paper bg, `depleted-banner.tsx` to coral-soft, `add-task-dialog` +
   `quick-add-task-form` + `login` `auth-form` to ocean tokens.
7. **Filters row (client-side).** Add the Усі/⚑Важливе/≤15хв/Під-мою-енергію
   chip row above the task list in `task-view.tsx`, filtering the already-
   loaded tasks client-side.

Aquarium nav tab in chunk 6 points at `/aquarium` — a stub page until Phase
3; Browse loses its nav tab but `/browse` routes stay.
