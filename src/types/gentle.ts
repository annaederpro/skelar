export type ResourceStatus = "depleted" | "normal" | "high";

export type TaskStatus = "todo" | "completed";

export type EnergyLevel = 1 | 2 | 3;

export interface DbUser {
  id: string;
  email: string;
  current_resource_status: ResourceStatus;
  telegram_chat_id: string | null;
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
}

export const ENERGY_LABEL: Record<EnergyLevel, string> = {
  1: "⚡️ Легка",
  2: "⚡️⚡️ Середня",
  3: "⚡️⚡️⚡️ Важка",
};

export const ENERGY_DOT_CLASS: Record<EnergyLevel, string> = {
  1: "bg-emerald-400",
  2: "bg-amber-400",
  3: "bg-rose-400",
};

export const ENERGY_BADGE_CLASS: Record<EnergyLevel, string> = {
  1: "bg-emerald-100 text-emerald-700 border-emerald-200",
  2: "bg-amber-100 text-amber-700 border-amber-200",
  3: "bg-rose-100 text-rose-700 border-rose-200",
};

export const RESOURCE_STATUS_LABEL: Record<ResourceStatus, string> = {
  depleted: "Виснажена",
  normal: "В нормі",
  high: "Повна сил",
};
