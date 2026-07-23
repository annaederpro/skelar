export type ResourceStatus = "depleted" | "normal" | "high";

export type TaskStatus = "todo" | "completed";

export type EnergyLevel = 1 | 2 | 3;

export type Priority = 1 | 2 | 3 | 4;

export interface DbUser {
  id: string;
  email: string;
  current_resource_status: ResourceStatus;
  telegram_chat_id: string | null;
  // Added by migration 0006 (per-user Telegram linking). Non-null only
  // while a generated code is awaiting use; cleared on successful link.
  telegram_link_code: string | null;
  telegram_link_code_expires_at: string | null;
  // Added by migration 0007. Null means the user hasn't set a name yet.
  display_name: string | null;
  created_at: string;
}

export interface DbProject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface DbTask {
  id: string;
  user_id: string;
  title: string;
  status: TaskStatus;
  energy_level: EnergyLevel;
  duration_minutes: number;
  is_backlog: boolean;
  created_at: string;
  project_id: string | null;
  priority: Priority;
  due_date: string | null;
  // "HH:MM:SS" from Postgres `time` (migration 0004). Never set without due_date.
  due_time: string | null;
  // Added by migration 0003 (Phase 2 — Focus). Absent/false until then.
  is_seeded: boolean;
  // Added by migration 0005 (Task Release). Null = active task; set = soft-
  // deleted, recoverable from "Кошик" until restored (released_at cleared).
  released_at: string | null;
  // Added by migration 0008. Set once at creation; not backfilled for older rows.
  source: "app" | "telegram";
}

// "25" → "25 хв", "180" → "3 год", "90" → "1 год 30 хв"
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} хв`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} год` : `${hours} год ${rest} хв`;
}

// Postgres `time` reads back as "HH:MM:SS"; the UI (cards and
// <input type="time">) wants "HH:MM".
export function formatDueTime(time: string): string {
  return time.slice(0, 5);
}

// Duration is edited as a raw string + unit ("30" + "хв" or "2" + "год") so
// task-fields-form.tsx's input can be cleared on iOS without artifacts, and
// converted to/from the DB's plain-minutes column at the edges.
export type DurationUnit = "min" | "hour";

// Long tasks read as hours ("3" + год), short ones as minutes ("15" + хв).
export function splitMinutesToDuration(minutes: number): { value: string; unit: DurationUnit } {
  if (minutes >= 60 && minutes % 30 === 0) {
    return { value: String(minutes / 60), unit: "hour" };
  }
  return { value: String(minutes), unit: "min" };
}

export function parseDurationMinutes(value: string, unit: DurationUnit): number {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.round(unit === "hour" ? n * 60 : n);
}

// coralQ effort words (energy_level rendered as "effort" on task cards)
export const EFFORT_WORD: Record<EnergyLevel, string> = {
  1: "легка",
  2: "середня",
  3: "глибока",
};

export const RESOURCE_STATUS_LABEL: Record<ResourceStatus, string> = {
  depleted: "Мало сил",
  normal: "В нормі",
  high: "Повний заряд",
};

// ── Priority: stored as 1–4 in the DB, presented as 3 human buckets in coralQ ──
export type PriorityBucket = "high" | "mid" | "low";

// DB value 1 → high, 2–3 → mid, 4 → low
export function priorityBucket(priority: Priority): PriorityBucket {
  if (priority === 1) return "high";
  if (priority === 4) return "low";
  return "mid";
}

// The three pickable buckets, in display order, with the DB value each writes back.
export const PRIORITY_BUCKETS: { bucket: PriorityBucket; value: Priority }[] = [
  { bucket: "high", value: 1 },
  { bucket: "mid", value: 2 },
  { bucket: "low", value: 4 },
];

export const PRIORITY_BUCKET_LABEL: Record<PriorityBucket, string> = {
  high: "Важливо",
  mid: "Звичайне",
  low: "Колись",
};

// pill styling (soft ocean tokens, no hard red)
export const PRIORITY_BUCKET_PILL_CLASS: Record<PriorityBucket, string> = {
  high: "bg-coral-soft text-coral",
  mid: "bg-muted text-ink-soft",
  low: "bg-sea-soft text-sea-deep",
};

// left card accent bar
export const PRIORITY_BUCKET_BAR_CLASS: Record<PriorityBucket, string> = {
  high: "bg-coral",
  mid: "bg-transparent",
  low: "bg-transparent",
};

// ── "Всі задачі" sort: importance first, then due date, completed last ──
// One comparator serves both the default view (active tasks grouped
// Важливо → Звичайне → Колись, completed tasks last, same internal
// grouping) and the isolated "Виконані" filter (list pre-filtered to
// status === "completed", so the status key below becomes a no-op
// tiebreaker and completed tasks still sort Важливо → Звичайне → Колись).
const PRIORITY_BUCKET_RANK: Record<PriorityBucket, number> = { high: 0, mid: 1, low: 2 };

export function compareTasksForAllTasksTab(a: DbTask, b: DbTask): number {
  const statusDiff = Number(a.status === "completed") - Number(b.status === "completed");
  if (statusDiff !== 0) return statusDiff;

  const bucketDiff =
    PRIORITY_BUCKET_RANK[priorityBucket(a.priority)] - PRIORITY_BUCKET_RANK[priorityBucket(b.priority)];
  if (bucketDiff !== 0) return bucketDiff;

  // Nearest due date first; no due date sorts to the end of the group.
  if (a.due_date !== b.due_date) {
    if (a.due_date === null) return 1;
    if (b.due_date === null) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }

  if (a.due_time !== b.due_time) {
    if (a.due_time === null) return 1;
    if (b.due_time === null) return -1;
    return a.due_time < b.due_time ? -1 : 1;
  }

  return 0; // stable sort preserves existing relative (fetch) order
}
