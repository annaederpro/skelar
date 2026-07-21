# AI-Assisted Task Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user type or speak a free-form task description and have it parsed by an LLM (via OpenRouter) into the same structured fields the existing manual add-task form already has, pre-filling that form for review before save.

**Architecture:** A pure server-side module (`src/lib/ai/parse-task.ts`) calls OpenRouter with a JSON-schema response format and validates the result with zod. A thin Server Action (`parseTaskWithAI` in `src/app/actions.ts`) wraps it with auth + the user's project list, following the exact pattern the existing `addTask` action already uses. `QuickAddTaskForm` gets a new "AI" mode (textarea + optional mic button using the Web Speech API) that calls this action and, on any outcome (success or failure), lands back on the familiar manual form for the user to review and submit themselves via the unchanged `addTask` path.

**Tech Stack:** Next.js 16 Server Actions, React 19 client components, zod (new dependency) for response validation, native `fetch` to OpenRouter's OpenAI-compatible REST API, the browser's native `SpeechRecognition`/`webkitSpeechRecognition` for voice-to-text (no audio upload, no new backend dependency for speech).

## Global Constraints

- No test runner exists in this repo (no vitest/jest configured) — verification steps in this plan use `npx tsc --noEmit` for type safety and manual verification via the dev server/preview tool, matching the project's existing convention (confirmed in the spec).
- `OPENROUTER_API_KEY` must be read only in server-side code (`src/lib/ai/parse-task.ts`, executed via the `"use server"` action) — never in a `"use client"` file, never prefixed `NEXT_PUBLIC_`.
- `parseTaskWithAI`/`parseTaskWithOpenRouter` never write to the database. All DB writes continue to go exclusively through the existing, unmodified `addTask`.
- Default model is `openai/gpt-4o-mini`, overridable via `OPENROUTER_MODEL` env var — never hardcode a different model without also reading the env override.
- Out of scope (do not implement): multi-task parsing from one input, audio upload/server-side transcription, new `description`/`tags` DB columns. See spec `docs/superpowers/specs/2026-07-21-ai-task-capture-design.md` for full rationale.
- All new UI copy is in Ukrainian, matching the existing app (see `quick-add-task-form.tsx`, `add-task-dialog.tsx` for tone/wording precedent).

---

### Task 1: Dependencies and env var scaffolding

**Files:**
- Modify: `package.json` (via `npm install`, not hand-edited)
- Modify: `.env.local.example`

**Interfaces:**
- Produces: the `zod` package available to import as `import { z } from "zod"` in later tasks.

- [ ] **Step 1: Install zod**

Run: `npm install zod`

Expected: `package.json` gains a `"zod": "^3.x.x"` entry under `"dependencies"`, `package-lock.json` updates, no errors.

- [ ] **Step 2: Add OpenRouter env vars to the example file**

Edit `.env.local.example` — insert a new section after the existing `# Gemini (Block 2)` block (do not remove or change the existing `GEMINI_API_KEY`/`TELEGRAM_BOT_TOKEN` lines):

```
# OpenRouter (AI task capture)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
```

- [ ] **Step 3: Verify**

Run: `cat .env.local.example`
Expected: file contains `OPENROUTER_API_KEY=` and `OPENROUTER_MODEL=` lines, and the pre-existing Supabase/Gemini/Telegram lines are unchanged.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit --no-gpg-sign -m "chore: add zod dependency and OpenRouter env var scaffolding"
```

---

### Task 2: AI parsing module

**Files:**
- Create: `src/lib/ai/parse-task.ts`

**Interfaces:**
- Consumes: `zod` (Task 1), `process.env.OPENROUTER_API_KEY`, `process.env.OPENROUTER_MODEL`, global `fetch`.
- Produces (used by Task 3):
  - `interface OpenRouterProject { id: string; name: string }`
  - `type ParsedTask = { title: string; priority: 1 | 2 | 3 | 4 | null; dueDate: string | null; energyLevel: 1 | 2 | 3 | null; durationMinutes: number | null; projectId: string | null }`
  - `type ParseTaskResult = ({ ok: true } & ParsedTask) | { ok: false; rawText: string }`
  - `async function parseTaskWithOpenRouter(rawText: string, projects: OpenRouterProject[], todayIso: string): Promise<ParseTaskResult>`

- [ ] **Step 1: Create the module**

Create `src/lib/ai/parse-task.ts`:

```ts
import { z } from "zod";

export interface OpenRouterProject {
  id: string;
  name: string;
}

const parsedTaskSchema = z.object({
  title: z.string().min(1),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  due_date: z.string().nullable(),
  energy_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  duration_minutes: z.number().int().positive().nullable(),
  project_id: z.string().nullable(),
});

export type ParsedTask = {
  title: string;
  priority: 1 | 2 | 3 | 4 | null;
  dueDate: string | null;
  energyLevel: 1 | 2 | 3 | null;
  durationMinutes: number | null;
  projectId: string | null;
};

export type ParseTaskResult = ({ ok: true } & ParsedTask) | { ok: false; rawText: string };

const RESPONSE_JSON_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "parsed_task",
    strict: true,
    schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        priority: { type: ["integer", "null"], enum: [1, 2, 3, 4, null] },
        due_date: {
          type: ["string", "null"],
          description: "ISO date YYYY-MM-DD, or null if no date was mentioned",
        },
        energy_level: { type: ["integer", "null"], enum: [1, 2, 3, null] },
        duration_minutes: { type: ["integer", "null"] },
        project_id: { type: ["string", "null"] },
      },
      required: [
        "title",
        "priority",
        "due_date",
        "energy_level",
        "duration_minutes",
        "project_id",
      ],
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(projects: OpenRouterProject[], todayIso: string): string {
  const projectList = projects.length
    ? projects.map((p) => `- ${p.name} (id: ${p.id})`).join("\n")
    : "(жодного проєкту немає — завжди повертай project_id: null)";

  return [
    "Ти розбираєш вільний текст користувача (написаний або сказаний вголос) на структуровану задачу для таск-менеджера.",
    `Сьогоднішня дата: ${todayIso} (YYYY-MM-DD). Використовуй її, щоб перевести відносні дати ("завтра", "у п'ятницю") у конкретну ISO-дату due_date.`,
    "Поля, які потрібно повернути:",
    "- title: коротка назва задачі (обов'язково, не порожня).",
    "- priority: 1 (дуже важливо), 2 або 3 (звичайне), 4 (колись/неважливо), або null якщо незрозуміло.",
    "- due_date: ISO-дата YYYY-MM-DD, або null якщо дата не згадана.",
    "- energy_level: 1 (легка задача), 2 (середня), 3 (потребує глибокого фокусу), або null якщо незрозуміло.",
    "- duration_minutes: орієнтовна тривалість у хвилинах, або null якщо не згадано.",
    "- project_id: id одного з проєктів користувача, ЯКЩО текст явно згадує його назву. Інакше null.",
    "Доступні проєкти користувача:",
    projectList,
    "Завжди повертай усі шість полів. Якщо щось невідомо — null, не вигадуй значення.",
  ].join("\n");
}

export async function parseTaskWithOpenRouter(
  rawText: string,
  projects: OpenRouterProject[],
  todayIso: string,
): Promise<ParseTaskResult> {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: false, rawText: trimmed };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, rawText: trimmed };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: buildSystemPrompt(projects, todayIso) },
          { role: "user", content: trimmed },
        ],
        response_format: RESPONSE_JSON_SCHEMA,
      }),
    });

    if (!response.ok) {
      return { ok: false, rawText: trimmed };
    }

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return { ok: false, rawText: trimmed };
    }

    const parsedJson = JSON.parse(content);
    const result = parsedTaskSchema.safeParse(parsedJson);
    if (!result.success) {
      return { ok: false, rawText: trimmed };
    }

    const validProjectIds = new Set(projects.map((p) => p.id));
    const projectId =
      result.data.project_id && validProjectIds.has(result.data.project_id)
        ? result.data.project_id
        : null;

    return {
      ok: true,
      title: result.data.title,
      priority: result.data.priority,
      dueDate: result.data.due_date,
      energyLevel: result.data.energy_level,
      durationMinutes: result.data.duration_minutes,
      projectId,
    };
  } catch {
    return { ok: false, rawText: trimmed };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `src/lib/ai/parse-task.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/parse-task.ts
git commit --no-gpg-sign -m "feat: add OpenRouter task-parsing module with zod validation"
```

---

### Task 3: `parseTaskWithAI` Server Action

**Files:**
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `parseTaskWithOpenRouter`, `OpenRouterProject`, `ParseTaskResult` from `@/lib/ai/parse-task` (Task 2); `createClient` from `@/lib/supabase/server` (already imported in this file).
- Produces (used by Task 5): `export async function parseTaskWithAI(rawText: string): Promise<ParseTaskResult>`

- [ ] **Step 1: Add the import**

In `src/app/actions.ts`, add to the existing import block (after the `@/types/gentle` import at line 12):

```ts
import { parseTaskWithOpenRouter, type ParseTaskResult } from "@/lib/ai/parse-task";
```

- [ ] **Step 2: Add the action**

Append at the end of `src/app/actions.ts` (after `createProject`, currently ending at line 252):

```ts

export async function parseTaskWithAI(rawText: string): Promise<ParseTaskResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, rawText };
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id);

  const todayIso = new Date().toISOString().slice(0, 10);
  return parseTaskWithOpenRouter(rawText, projects ?? [], todayIso);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `src/app/actions.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions.ts
git commit --no-gpg-sign -m "feat: add parseTaskWithAI server action"
```

---

### Task 4: Speech-to-text hook

**Files:**
- Create: `src/types/speech-recognition.d.ts`
- Create: `src/hooks/use-speech-recognition.ts`

**Interfaces:**
- Produces (used by Task 5): `function useSpeechRecognition(options: { lang?: string; onResult: (transcript: string) => void }): { isSupported: boolean; isListening: boolean; start: () => void; stop: () => void }`

- [ ] **Step 1: Add ambient types for the Web Speech API**

`lib.dom.d.ts` doesn't declare `SpeechRecognition` (non-standardized API). Create `src/types/speech-recognition.d.ts`:

```ts
interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string };
  isFinal: boolean;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}
```

- [ ] **Step 2: Create the hook**

Create `src/hooks/use-speech-recognition.ts`:

```ts
"use client";

import { useCallback, useRef, useState } from "react";

interface UseSpeechRecognitionOptions {
  lang?: string;
  onResult: (transcript: string) => void;
}

export function useSpeechRecognition({ lang = "uk-UA", onResult }: UseSpeechRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  const start = useCallback(() => {
    if (recognitionRef.current) return;

    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          onResult(result[0].transcript);
        }
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [lang, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  return { isSupported, isListening, start, stop };
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `src/types/speech-recognition.d.ts` or `src/hooks/use-speech-recognition.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/types/speech-recognition.d.ts src/hooks/use-speech-recognition.ts
git commit --no-gpg-sign -m "feat: add useSpeechRecognition hook for voice-to-text input"
```

---

### Task 5: Wire the AI mode into the add-task UI

**Files:**
- Modify: `src/components/gentle/quick-add-task-form.tsx`
- Modify: `src/components/gentle/add-task-dialog.tsx`

**Interfaces:**
- Consumes: `useSpeechRecognition` (Task 4), `parseTaskWithAI` + `ParseTaskResult` (Task 3).
- Produces: `QuickAddTaskForm` gains a required `onParseWithAI: (rawText: string) => Promise<ParseTaskResult>` prop. `onAdd` prop and its call signature are unchanged.

- [ ] **Step 1: Rewrite `quick-add-task-form.tsx`**

Replace the full contents of `src/components/gentle/quick-add-task-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Mic, Square, Loader2 } from "lucide-react";
import type { DbProject, EnergyLevel, Priority } from "@/types/gentle";
import {
  EFFORT_WORD,
  priorityBucket,
  PRIORITY_BUCKETS,
  PRIORITY_BUCKET_LABEL,
} from "@/types/gentle";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import type { ParseTaskResult } from "@/lib/ai/parse-task";

interface QuickAddTaskFormProps {
  onAdd: (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
    projectId: string | null;
    priority: Priority;
    dueDate: string | null;
  }) => void;
  onParseWithAI: (rawText: string) => Promise<ParseTaskResult>;
  disabledEnergyLevels?: EnergyLevel[];
  projects?: DbProject[];
}

const ENERGY_OPTIONS: EnergyLevel[] = [1, 2, 3];

export function QuickAddTaskForm({
  onAdd,
  onParseWithAI,
  disabledEnergyLevels = [],
  projects = [],
}: QuickAddTaskFormProps) {
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [title, setTitle] = useState("");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(1);
  const [duration, setDuration] = useState(30);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>(4);
  const [dueDate, setDueDate] = useState("");

  const [aiText, setAiText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const {
    isSupported: isMicSupported,
    isListening,
    start: startListening,
    stop: stopListening,
  } = useSpeechRecognition({
    onResult: (transcript) =>
      setAiText((prev) => (prev ? `${prev} ${transcript}` : transcript)),
  });

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

  const handleParse = async () => {
    const trimmed = aiText.trim();
    if (!trimmed) {
      setParseError("Введіть текст.");
      return;
    }

    setIsParsing(true);
    setParseError(null);
    const result = await onParseWithAI(trimmed);
    setIsParsing(false);

    if (result.ok) {
      setTitle(result.title);
      if (result.priority) setPriority(result.priority);
      if (result.energyLevel) setEnergyLevel(result.energyLevel);
      if (result.durationMinutes) setDuration(result.durationMinutes);
      setProjectId(result.projectId);
      setDueDate(result.dueDate ?? "");
    } else {
      setTitle(result.rawText);
      setParseError("Не вдалося розібрати автоматично, перевірте поля.");
    }
    setMode("manual");
  };

  const activeBucket = priorityBucket(priority);

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-card p-3">
      <div className="flex gap-1 rounded-full bg-muted p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={cn(
            "flex-1 rounded-full py-1.5 transition-colors",
            mode === "manual" ? "bg-card text-ink" : "text-ink-soft",
          )}
        >
          Вручну
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={cn(
            "flex-1 rounded-full py-1.5 transition-colors",
            mode === "ai" ? "bg-card text-ink" : "text-ink-soft",
          )}
        >
          AI
        </button>
      </div>

      {mode === "ai" ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
            placeholder="Напиши або скажи, що потрібно зробити..."
            rows={3}
            autoFocus
            className="w-full resize-none rounded-md border border-line bg-transparent px-3 py-2 text-sm"
          />
          {parseError && <p className="text-xs text-coral">{parseError}</p>}
          <div className="flex items-center gap-2">
            {isMicSupported && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => (isListening ? stopListening() : startListening())}
                aria-label={isListening ? "Зупинити запис" : "Записати голосом"}
              >
                {isListening ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="flex-1 rounded-full"
              disabled={isParsing}
              onClick={handleParse}
            >
              {isParsing && <Loader2 className="size-3.5 animate-spin" />}
              Розібрати
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            placeholder="Що потрібно зробити?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          {/* effort (energy) */}
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
                    energyLevel === level ? "border-sea" : "border-transparent",
                  )}
                  aria-label={`Зусилля: ${EFFORT_WORD[level]}`}
                >
                  <span
                    className={cn(
                      "size-3 rounded-full",
                      level <= energyLevel ? "bg-sea" : "bg-line",
                    )}
                  />
                </button>
              );
            })}
            <span className="text-xs text-ink-soft">{EFFORT_WORD[energyLevel]}</span>

            <Input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 0)}
              className="ml-2 w-20"
            />
            <span className="text-xs text-ink-soft">хв</span>
          </div>

          {/* priority — 3 human buckets */}
          <div className="flex items-center gap-2">
            {PRIORITY_BUCKETS.map(({ bucket, value }) => (
              <button
                key={bucket}
                type="button"
                onClick={() => setPriority(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                  activeBucket === bucket
                    ? "border-sea bg-sea-soft text-sea-deep"
                    : "border-line bg-card text-ink-soft",
                )}
                aria-label={`Пріоритет: ${PRIORITY_BUCKET_LABEL[bucket]}`}
                aria-pressed={activeBucket === bucket}
              >
                {PRIORITY_BUCKET_LABEL[bucket]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={projectId ?? ""}
              onChange={(e) => setProjectId(e.target.value || null)}
              aria-label="Проєкт"
              className="h-9 flex-1 rounded-md border border-line bg-transparent px-3 text-sm"
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
              aria-label="Дата виконання"
              className="h-9 rounded-md border border-line bg-transparent px-3 text-sm text-ink-soft"
            />
          </div>

          <Button type="submit" size="sm" className="w-full rounded-full">
            <Plus className="size-4" />
            Додати
          </Button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `add-task-dialog.tsx`**

In `src/components/gentle/add-task-dialog.tsx`, change the import on line 13 from:

```ts
import { addTask } from "@/app/actions";
```

to:

```ts
import { addTask, parseTaskWithAI } from "@/app/actions";
```

Then change the `<QuickAddTaskForm ... />` call (lines 71–75) from:

```tsx
        <QuickAddTaskForm
          onAdd={handleAdd}
          disabledEnergyLevels={disabledEnergyLevels}
          projects={projects}
        />
```

to:

```tsx
        <QuickAddTaskForm
          onAdd={handleAdd}
          onParseWithAI={parseTaskWithAI}
          disabledEnergyLevels={disabledEnergyLevels}
          projects={projects}
        />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. In particular, confirm no error like "Property 'onParseWithAI' is missing" — that would mean Step 2 wasn't applied correctly.

- [ ] **Step 4: Manual verification — regression check (no OpenRouter key needed)**

Start the dev server and use the preview tool:
1. Open the app, click the FAB (bottom-right `+`) to open "Нова задача".
2. Confirm it opens on "Вручну" mode, looking exactly as before (title input, effort dots, priority pills, project select, due date, "Додати" button).
3. Fill in a title and click "Додати" — confirm the task is created and the dialog closes (this exercises the untouched `addTask` path — must still work exactly as before).

- [ ] **Step 5: Manual verification — AI mode, no API key yet**

`OPENROUTER_API_KEY` is expected to be unset at this point (confirm with `grep OPENROUTER_API_KEY .env.local` — if it prints nothing or an empty value, proceed):
1. Open "Нова задача" again, click the "AI" tab.
2. Confirm the textarea appears, plus a mic button *only if* the preview's browser supports `SpeechRecognition` (Chromium-based browsers do — the button should appear; this only confirms feature detection renders it, not that recording works, since mic permission grants aren't available in the automated preview).
3. Type any text, e.g. "Завтра зателефонувати клієнту".
4. Click "Розібрати".
5. Expected: because no API key is configured, `parseTaskWithOpenRouter` returns `{ ok: false, rawText }` immediately — the view should switch back to "Вручну" with the title field pre-filled to "Завтра зателефонувати клієнту" and an inline message "Не вдалося розібрати автоматично, перевірте поля." above the form.

This confirms the full failure-fallback path end-to-end without needing a live key.

- [ ] **Step 6: Commit**

```bash
git add src/components/gentle/quick-add-task-form.tsx src/components/gentle/add-task-dialog.tsx
git commit --no-gpg-sign -m "feat: add AI text/voice mode to the add-task form"
```

---

### Task 6: Live verification with a real OpenRouter key

**Files:** none (verification only)

**Interfaces:** none — this task only exercises the already-completed integration.

This task is gated on the user having added a real `OPENROUTER_API_KEY` to `.env.local` (see the design spec's Environment section). If it's still missing, stop here and hand back to the user rather than guessing at a fake key.

- [ ] **Step 1: Confirm the key is present without printing it**

Run: `grep -q '^OPENROUTER_API_KEY=.\+' .env.local && echo present || echo missing`
Expected: `present`. If `missing`, stop this task and tell the user the key still needs to be added before live verification can run.

- [ ] **Step 2: Restart the dev server**

The env var is only read at server start — restart so the new value is picked up.

- [ ] **Step 3: Manual verification — successful parse**

Using the preview tool:
1. Open "Нова задача" → "AI" tab.
2. Type: "Завтра зателефонувати клієнту, це важливо, займе хвилин 15".
3. Click "Розібрати".
4. Expected: view switches to "Вручну" with title populated (something like "Зателефонувати клієнту"), priority set to the "Важливо" bucket, duration around 15, due date set to tomorrow's date. No inline error shown.
5. Review the fields, click "Додати", confirm the task appears in the task list with those values.

- [ ] **Step 4: Manual verification — project matching**

1. Ensure at least one project exists (create one via the existing project UI if needed) — note its exact name.
2. Open "Нова задача" → "AI" tab, type text that names that project explicitly, e.g. "Додати задачу в проєкт <name>: полити квіти".
3. Click "Розібрати" — expected: the project `<select>` is pre-set to that project after parsing.

- [ ] **Step 5: Commit (if any follow-up fixes were needed)**

Only commit if Steps 3–4 required code changes to pass. If verification passed with no changes, there is nothing to commit for this task.

```bash
git add -A
git commit --no-gpg-sign -m "fix: address issues found in live OpenRouter verification"
```
