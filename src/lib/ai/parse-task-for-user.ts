import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTaskWithOpenRouter, type ParseTaskListResult } from "@/lib/ai/parse-task";
import { getAppToday } from "@/lib/date";

/**
 * Fetches the user's projects and runs the OpenRouter parser. Shared by the
 * browser Server Action and the Telegram bot; the Supabase client decides
 * whose credentials apply (cookie session vs service role).
 */
export async function parseTaskForUser(
  supabase: SupabaseClient,
  userId: string,
  rawText: string,
): Promise<ParseTaskListResult> {
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", userId);

  return parseTaskWithOpenRouter(rawText, projects ?? [], getAppToday());
}
