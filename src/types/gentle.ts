export type ResourceStatus = "depleted" | "normal" | "high";

export type TaskStatus = "todo" | "completed";

export type EnergyLevel = 1 | 2 | 3;

export type Priority = 1 | 2 | 3 | 4;

export interface DbUser {
  id: string;
  email: string;
  current_resource_status: ResourceStatus;
  telegram_chat_id: string | null;
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
  // Added by migration 0003 (Phase 2 — Focus). Absent/false until then.
  is_seeded: boolean;
}

// "25" → "25 хв", "180" → "3 год", "90" → "1 год 30 хв"
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} хв`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} год` : `${hours} год ${rest} хв`;
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
