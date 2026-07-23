# coralQ: Add-to-calendar export for tasks

## Problem

coralQ tasks can carry a due date and (optionally) a due time, but there's no
way to get a task onto a user's personal calendar (Apple Calendar, Google
Calendar, Outlook, etc). Users have to re-enter the task by hand elsewhere.

## Goal

A one-tap "add to calendar" action on any active task with a due date, that
produces a standard `.ics` file the user's OS/calendar app can open directly.
No accounts, no OAuth, no backend/API calls, no new dependency.

## Non-goals

- Two-way sync (calendar → coralQ or ongoing updates after export)
- Google Calendar deep links (still `.ics`-only per user choice)
- Bulk export of multiple tasks at once
- Recurring events (coralQ tasks aren't recurring)

## Behavior

**Button visibility** — a calendar icon button appears on a `TaskCard` only
when all of:
- `task.due_date` is set
- `task.status !== "completed"`
- card `variant !== "released"` (hidden in the trash view)

**Event content:**
- `SUMMARY` = `task.title`
- Timed event when `task.due_date` **and** `task.due_time` are both set:
  `DTSTART` = due_date + due_time, `DTEND` = `DTSTART + duration_minutes`
- All-day event when `task.due_date` is set but `task.due_time` is null:
  `DTSTART;VALUE=DATE` = due_date, `DTEND;VALUE=DATE` = due_date + 1 day
  (ICS all-day `DTEND` is exclusive)
- `UID` = `` `${task.id}@coralq` `` — stable per task, so re-downloading the
  same task's `.ics` and re-importing it updates rather than duplicates the
  event in calendar apps that dedupe by UID
- `DTSTAMP` = export time (required by RFC 5545)
- Times are written as floating local time (no `Z` suffix, no `TZID`) — the
  app is single-timezone today, so this sidesteps timezone-offset bugs
  entirely rather than half-solving them

**Download mechanism:** client-side only. Build the `.ics` text in the
browser, wrap it in a `Blob` (`text/calendar`), create an object URL, trigger
it via a synthetic `<a download>` click, then revoke the URL. No network
request, no server route.

## Architecture

Two touch points, both additive — no existing files' behavior changes for
tasks that don't have a due date.

### `src/lib/ics.ts` (new)

Pure functions, no React:

- `buildTaskIcs(task: DbTask): string` — returns the full `.ics` file text
  for one task. Internally handles the timed-vs-all-day branch, RFC 5545
  text escaping (commas, semicolons, backslashes, newlines) for `SUMMARY`,
  and date/time formatting (`YYYYMMDDTHHMMSS` / `YYYYMMDD`).
- `downloadIcs(filename: string, content: string): void` — the
  Blob/object-URL/synthetic-click download helper described above.

Guard: `buildTaskIcs` throws if `due_date` is null — callers (the button)
only render/invoke it when a due date exists, so this is a programmer-error
guard, not user-facing validation.

### `src/components/gentle/task-card.tsx` (edit)

- Import `CalendarPlus` from `lucide-react`, and `buildTaskIcs` /
  `downloadIcs` from `src/lib/ics.ts`.
- Add a small icon-only button next to the existing due-date text, rendered
  under the same condition described above (due_date set, not completed,
  not released).
- `onClick`: `e.stopPropagation()` (so it doesn't also fire the card's
  edit-open handler), then `downloadIcs(<slug>.ics, buildTaskIcs(task))`.
- Filename: a simple slug of the title plus `.ics` (fallback to `task.ics`
  if the slug would be empty after stripping non-alphanumerics).

No other file changes — `task-list.tsx` and every page that renders tasks
(Today, Upcoming, Browse) pick this up for free since they all go through
`TaskCard`.

## Testing

No test framework is configured in this repo. Verification is manual via
the dev server:
1. A task with `due_date` + `due_time` → downloaded `.ics` opens as a timed
   event at the right time, lasting `duration_minutes`.
2. A task with `due_date` only → opens as an all-day event on the right day.
3. A completed task and a released (trashed) task with a due date → no
   button shown.
4. A task with no `due_date` → no button shown.
5. Title with special characters (comma, semicolon) → imports without
   corrupting the calendar app's event text.
