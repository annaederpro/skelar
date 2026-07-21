# AI-assisted task capture — design spec

## Context

coralQ currently creates tasks only through a manual form: `Fab` opens
`AddTaskDialog`, which wraps `QuickAddTaskForm` (title input, effort/energy
picker, 3-bucket priority picker, project select, due-date input). All
writes go through the `addTask` Server Action in `src/app/actions.ts`.

This spec adds a second way to create a task: free-form text or speech,
parsed by an LLM (via OpenRouter) into the same structured fields the manual
form already has. It does not add a description/tags field, multi-task
input, or any new DB columns — those are explicitly out of scope for this
pass (see Non-goals).

This is the first external API integration in the codebase (no API routes,
no LLM SDK, no `OPENROUTER_API_KEY` usage exist yet). The user pasted a live
OpenRouter key in chat earlier this session and has since rotated it; the
new key must only ever live in `.env.local` (gitignored), read server-side.

## Decisions locked with the user before writing this spec

- MVP handles **one task per input** (parsing "buy milk and call mom" into
  two tasks is an explicit future extension, not in scope here).
- Both **typed text and voice** are supported in this pass, using the
  **Web Speech API** (`SpeechRecognition`/`webkitSpeechRecognition`) to
  transcribe speech to text **client-side, in the browser** — no audio is
  recorded, uploaded, or sent to any server. Voice is purely an alternate
  way to fill the same text field; everything downstream of that point is
  identical to the typed-text path.
- The AI entry point lives **inside the existing `AddTaskDialog`**, not as a
  separate button/flow off the FAB.
- After parsing, the user always sees the **familiar manual form, pre-filled**
  — they review/edit and press "Add" themselves. The AI step never saves a
  task directly.
- On any AI failure (network error, OpenRouter error, invalid/empty parse),
  show an inline error **and still open the manual form**, with
  `title` pre-filled to the raw text the user typed/spoke. No dead end.
- Architecture: a new **Server Action** (consistent with the existing
  `addTask`/`toggleTaskComplete` pattern — this app has no API routes).
  `OPENROUTER_API_KEY` is read server-side only, never exposed to the client.
- OpenRouter response uses **structured output** (`response_format:
  json_schema`), validated with **zod** (new dependency — no schema
  validation library exists in the repo yet). Default model
  `openai/gpt-4o-mini`, overridable via `OPENROUTER_MODEL` env var.

## Non-goals (this pass)

- Multiple tasks parsed from one input.
- Audio upload / server-side transcription (Whisper, OpenRouter audio
  models). Voice is Web Speech API only; if the browser doesn't support it,
  the mic button is simply not rendered (feature detection), typed text
  still works.
- A `description` or `tags` field — the DB schema (`tasks` table) is
  unchanged. The AI only ever fills fields that already exist:
  `title`, `priority`, `due_date`, `energy_level`, `duration_minutes`,
  `project_id`.
- Any change to `addTask` itself, or to how manually-created tasks work.

## Architecture and data flow

```
QuickAddTaskForm (client component, extended)
  ├─ "Manual" mode — existing form, unchanged
  └─ "AI" mode (new) — textarea + optional mic button
       (mic: SpeechRecognition writes transcribed text into the same
        textarea; if SpeechRecognition is unsupported, no mic button)
       → user clicks "Розібрати" (Parse)
       → parseTaskWithAI(rawText)  [new Server Action, src/app/actions.ts]
            → fetch user's projects (already-loaded list, passed in)
            → build prompt: system message with field descriptions,
              today's server date (for relative dates like "завтра"),
              and the user's {id, name} project list; user message = rawText
            → POST to OpenRouter chat completions with
              response_format: { type: "json_schema", json_schema: {...} }
            → zod-parse the model's JSON response
            → on success: return { ok: true, title, priority, dueDate,
              energyLevel, durationMinutes, projectId }
            → on any failure (fetch error, non-2xx, invalid JSON, zod
              validation failure, empty/missing title): return
              { ok: false, rawText }
       → switches back to "Manual" view:
            success → fields pre-filled from the parsed result, focus on
                      title for a quick edit
            failure → title = rawText, small inline message
                      ("Не вдалося розібрати автоматично, перевірте поля")
       → user reviews/edits, clicks "Add" → existing addTask, unchanged
```

`parseTaskWithAI` never touches the database. It is a pure
text-in/structured-fields-out function. The actual write path (`addTask`)
is not modified by this feature at all, which keeps the blast radius of a
new, less-tested code path limited to prefilling a form.

## Server Action: `parseTaskWithAI`

Location: `src/app/actions.ts`, alongside `addTask`.

```ts
type ParseTaskResult =
  | { ok: true; title: string; priority: Priority | null;
      dueDate: string | null; energyLevel: EnergyLevel | null;
      durationMinutes: number | null; projectId: string | null }
  | { ok: false; rawText: string };

async function parseTaskWithAI(rawText: string): Promise<ParseTaskResult>
```

- Auth: same pattern as `addTask` — gets the authed user via
  `createClient()` from `src/lib/supabase/server.ts`; fetches that user's
  `projects` (id, name) to include as matchable candidates in the prompt.
- Trims/rejects empty `rawText` early (returns `{ ok: false, rawText }`
  without calling OpenRouter).
- Builds an OpenRouter chat completion request:
  - `model`: `process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini"`
  - `response_format`: JSON schema requiring `title` (string, required) and
    nullable `priority` (1-4), `due_date` (ISO date string), `energy_level`
    (1-3), `duration_minutes` (number), `project_id` (string, must be one of
    the provided project ids or null).
  - System prompt includes today's date (server clock) so the model can
    resolve "завтра" / "next Monday" into an actual ISO date.
- Zod schema mirrors the JSON schema and is the actual gate for what the
  Server Action returns — even if OpenRouter's structured output is
  malformed or a model ignores the schema, invalid responses become
  `{ ok: false, rawText }` rather than a runtime crash or bad data reaching
  the form.
- Any thrown error (network, non-2xx from OpenRouter, JSON parse failure) is
  caught and mapped to `{ ok: false, rawText }` — errors are never silently
  swallowed without a status; they always resolve to a value the client can
  branch on. (This mirrors the "don't silently swallow errors" fix already
  applied to Focus mode this session.)

## UI changes

`src/components/gentle/quick-add-task-form.tsx`:
- Add a small mode switch ("Вручну" / "AI") above the existing fields.
- AI mode renders: a `<textarea>` for free text, a mic icon-button (rendered
  only if `window.SpeechRecognition ?? window.webkitSpeechRecognition`
  exists), and a "Розібрати" button that calls `parseTaskWithAI` and shows a
  loading state while pending.
- Mic button: starts/stops `SpeechRecognition`, appends interim/final
  transcript into the textarea. No new audio infra — this is the same kind
  of browser-gesture-tied API interaction as the existing
  `AudioContext.resume()` handling in `src/lib/ocean-noise.ts`, just a
  different Web API.
- On `parseTaskWithAI` resolving, switch back to "Manual" mode with the
  existing form fields populated (success) or just `title` populated plus
  an inline error string (failure). The existing "Add" button and `onAdd`
  callback are untouched.

## Error handling

| Failure | Behavior |
|---|---|
| Empty/whitespace-only input | Don't call OpenRouter; show "Введіть текст" inline, stay in AI mode |
| Network/timeout calling OpenRouter | `{ ok: false, rawText }` → manual form, title = rawText, inline error |
| OpenRouter non-2xx (rate limit, auth, etc.) | Same as above |
| Model returns invalid/non-schema JSON | Zod validation fails → same as above |
| `project_id` in response doesn't match any of the user's real projects | Coerced to `null` rather than failing the whole parse |
| Browser has no `SpeechRecognition` | Mic button not rendered; typed text still works |

No AI failure ever blocks task creation — it always degrades to the
existing manual flow.

## Testing

No test runner exists in this repo (no vitest/jest configured) — this
follows the existing project convention of manual verification via the dev
preview rather than an automated suite. Manual verification for this
feature:
- Typed text, clear case: "Завтра зателефонувати клієнту, це важливо" →
  reasonable due date, priority, title.
- Typed text mentioning an existing project by name → `project_id` matches.
- Empty input → inline validation message, no request sent.
- Simulated OpenRouter failure (e.g. temporarily wrong model name) →
  fallback form with raw text as title, inline error shown.
- Voice input in a browser that supports `SpeechRecognition` (Chrome) →
  mic transcribes into textarea.
- Voice button absence in a browser without `SpeechRecognition` (or via
  forcing the feature-detection branch) — confirm no crash, just no button.

## Environment / secrets

Add to `.env.local.example` (names only, no values):
- `OPENROUTER_API_KEY` — server-side only, read in `parseTaskWithAI`.
- `OPENROUTER_MODEL` — optional, defaults to `openai/gpt-4o-mini` if unset.

`OPENROUTER_API_KEY` must never be prefixed `NEXT_PUBLIC_` and must never be
read from a `"use client"` file.

## Self-authored decisions (assumptions — user may veto at spec review)

- Default model `openai/gpt-4o-mini`: cheap, supports structured JSON output
  reliably on OpenRouter. Overridable via env without a code change.
- Plain `fetch()` to OpenRouter's OpenAI-compatible REST endpoint rather
  than pulling in an SDK (`openai` package or similar) — this is a single
  call site, an SDK would be a dependency for one `fetch` call.
- Mic button transcribes into the *same* textarea used for typed input
  rather than a separate UI element — keeps the AI-mode surface to one
  input control.
- Zod added as a new dependency for response validation; no existing
  validation library to reuse.
