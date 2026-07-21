import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbTask, EnergyLevel, Priority } from "@/types/gentle";

export type InsertTaskInput = {
  title: string;
  energyLevel: EnergyLevel;
  durationMinutes: number;
  projectId?: string | null;
  priority?: Priority;
  dueDate?: string | null;
  dueTime?: string | null;
};

/**
 * Core task insert shared by the browser path (cookie-authenticated client)
 * and the Telegram bot (service-role admin client). The caller is responsible
 * for having resolved a trustworthy userId for the given client.
 */
export async function insertTaskForUser(
  supabase: SupabaseClient,
  userId: string,
  input: InsertTaskInput,
): Promise<{ task: DbTask } | { error: string }> {
  if (input.projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.projectId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!project) {
      return { error: "Проєкт не знайдено." };
    }
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title,
      energy_level: input.energyLevel,
      duration_minutes: input.durationMinutes,
      project_id: input.projectId ?? null,
      priority: input.priority ?? 4,
      due_date: input.dueDate ?? null,
      due_time: input.dueDate ? (input.dueTime ?? null) : null,
    })
    .select()
    .single();

  if (error || !data) {
    return { error: "Не вдалося додати задачу, спробуй ще раз." };
  }

  return { task: data as DbTask };
}
