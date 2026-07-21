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
