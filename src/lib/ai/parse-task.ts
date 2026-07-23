import { z } from "zod";

export interface OpenRouterProject {
  id: string;
  name: string;
}

const parsedTaskSchema = z.object({
  title: z.string().min(1),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  due_date: z.string().nullable(),
  due_time: z.string().nullable(),
  energy_level: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  duration_minutes: z.number().int().positive().nullable(),
  project_id: z.string().nullable(),
});

const parsedTaskListSchema = z.object({
  tasks: z.array(parsedTaskSchema).min(1),
});

export type ParsedTask = {
  title: string;
  priority: 1 | 2 | 3 | 4 | null;
  dueDate: string | null;
  dueTime: string | null;
  energyLevel: 1 | 2 | 3 | null;
  durationMinutes: number | null;
  projectId: string | null;
};

// Unchanged on purpose: src/components/gentle/quick-add-task-form.tsx
// imports this exact type for its single-task AI-prefill flow.
export type ParseTaskResult = ({ ok: true } & ParsedTask) | { ok: false; rawText: string };

// New multi-task shape — used by parseTaskForUser and the Telegram bot.
export type ParseTaskListResult =
  | { ok: true; tasks: ParsedTask[] }
  | { ok: false; rawText: string };

const TASK_ITEM_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    priority: { type: ["integer", "null"], enum: [1, 2, 3, 4, null] },
    due_date: {
      type: ["string", "null"],
      description: "ISO date YYYY-MM-DD, or null if no date was mentioned",
    },
    due_time: {
      type: ["string", "null"],
      description: "24-hour HH:MM, or null if no time of day was mentioned",
    },
    energy_level: { type: ["integer", "null"], enum: [1, 2, 3, null] },
    duration_minutes: { type: ["integer", "null"] },
    project_id: { type: ["string", "null"] },
  },
  required: [
    "title",
    "priority",
    "due_date",
    "due_time",
    "energy_level",
    "duration_minutes",
    "project_id",
  ],
  additionalProperties: false,
};

// `minItems` is a hint for the model, not an enforced guarantee — OpenAI /
// OpenRouter structured-output strict mode doesn't reliably enforce
// array-length keywords. `parsedTaskListSchema`'s `.min(1)` below is the
// real gate: a `tasks: []` response fails validation and becomes
// `{ ok: false, rawText }`, same as any other unparseable input.
const RESPONSE_JSON_SCHEMA = {
  type: "json_schema" as const,
  json_schema: {
    name: "parsed_task_list",
    strict: true,
    schema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          minItems: 1,
          items: TASK_ITEM_JSON_SCHEMA,
        },
      },
      required: ["tasks"],
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(projects: OpenRouterProject[], todayIso: string): string {
  const projectList = projects.length
    ? projects.map((p) => `- ${p.name} (id: ${p.id})`).join("\n")
    : "(жодного проєкту немає — завжди повертай project_id: null)";

  return [
    "Ти розбираєш вільний текст користувача (написаний або сказаний вголос) на одну або кілька структурованих задач для таск-менеджера.",
    "Кожна задача — окремий об'єкт у масиві tasks.",
    "Правило розбиття: одна задача на один ЧІТКО ОКРЕМИЙ намір/дію. Якщо в тексті кілька дрібних пунктів ОДНОГО роду (наприклад, список покупок: 'купити хліб і молоко') — це ОДНА задача, не розбивай по пунктах. Але якщо згадано кілька різних дій ('виспатись і подзвонити мамі') — це дві окремі задачі.",
    `Сьогоднішня дата: ${todayIso} (YYYY-MM-DD). Використовуй її, щоб перевести відносні дати ("завтра", "у п'ятницю") у конкретну ISO-дату due_date.`,
    "Поля кожної задачі:",
    "- title: коротка назва задачі (обов'язково, не порожня).",
    "- priority: 1 (дуже важливо), 2 або 3 (звичайне), 4 (колись/неважливо), або null якщо незрозуміло.",
    "- due_date: ISO-дата YYYY-MM-DD, або null якщо дата не згадана.",
    "- due_time: час доби у 24-годинному форматі HH:MM ('о 15:00' → '15:00'), або null якщо час не згадано. Ніколи не вигадуй час.",
    "- Якщо згадано час, але не дату — постав due_date на сьогодні.",
    "- energy_level: 1 (легка задача), 2 (середня), 3 (потребує глибокого фокусу), або null якщо незрозуміло.",
    "- duration_minutes: орієнтовна тривалість у хвилинах, або null якщо не згадано.",
    "- project_id: id одного з проєктів користувача, ЯКЩО текст явно згадує його назву. Інакше null.",
    "Доступні проєкти користувача:",
    projectList,
    "Кожна задача завжди має всі сім полів. Якщо щось невідомо — null, не вигадуй значення.",
  ].join("\n");
}

function toParsedTask(
  data: z.infer<typeof parsedTaskSchema>,
  projects: OpenRouterProject[],
  todayIso: string,
): ParsedTask {
  const validProjectIds = new Set(projects.map((p) => p.id));
  const projectId =
    data.project_id && validProjectIds.has(data.project_id) ? data.project_id : null;

  // A malformed time degrades to null rather than failing the whole parse;
  // a time without a date gets today's date (mirrors the prompt rule).
  const rawTime = data.due_time;
  const dueTime =
    rawTime && /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime) ? rawTime.slice(0, 5) : null;

  return {
    title: data.title,
    priority: data.priority,
    dueDate: data.due_date ?? (dueTime ? todayIso : null),
    dueTime,
    energyLevel: data.energy_level,
    durationMinutes: data.duration_minutes,
    projectId,
  };
}

export async function parseTaskWithOpenRouter(
  rawText: string,
  projects: OpenRouterProject[],
  todayIso: string,
): Promise<ParseTaskListResult> {
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
    const result = parsedTaskListSchema.safeParse(parsedJson);
    if (!result.success) {
      return { ok: false, rawText: trimmed };
    }

    return {
      ok: true,
      tasks: result.data.tasks.map((task) => toParsedTask(task, projects, todayIso)),
    };
  } catch {
    return { ok: false, rawText: trimmed };
  }
}
