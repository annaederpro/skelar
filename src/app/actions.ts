"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ParseTaskResult } from "@/lib/ai/parse-task";
import { parseTaskForUser } from "@/lib/ai/parse-task-for-user";
import { insertTaskForUser } from "@/lib/tasks/insert-task";
import { generateLinkCode, LINK_CODE_TTL_MINUTES } from "@/lib/telegram/link-code";
import type {
  DbProject,
  DbTask,
  EnergyLevel,
  Priority,
  ResourceStatus,
  TaskStatus,
} from "@/types/gentle";

export type AuthFormState = {
  error: string | null;
  message: string | null;
};

function mapAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "Невірний email або пароль.";
  }
  if (message.includes("User already registered")) {
    return "Користувач з таким email вже зареєстрований.";
  }
  if (message.includes("Password should be at least")) {
    return "Пароль має містити щонайменше 6 символів.";
  }
  return "Щось пішло не так, спробуй ще раз.";
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: mapAuthError(error.message), message: null };
  }

  redirect("/");
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: mapAuthError(error.message), message: null };
  }

  if (!data.session) {
    return {
      error: null,
      message: "Перевір пошту — надіслали лист для підтвердження реєстрації.",
    };
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function addTask(input: {
  title: string;
  energyLevel: EnergyLevel;
  durationMinutes: number;
  projectId?: string | null;
  priority?: Priority;
  dueDate?: string | null;
  dueTime?: string | null;
}): Promise<{ task: DbTask } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  return insertTaskForUser(supabase, user.id, input);
}

export async function updateTask(
  taskId: string,
  input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
    projectId: string | null;
    priority: Priority;
    dueDate: string | null;
    dueTime: string | null;
  },
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  if (input.projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!project) {
      return { error: "Проєкт не знайдено." };
    }
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      title: input.title,
      energy_level: input.energyLevel,
      duration_minutes: input.durationMinutes,
      project_id: input.projectId,
      priority: input.priority,
      due_date: input.dueDate,
      due_time: input.dueDate ? input.dueTime : null,
    })
    .eq("id", taskId);

  if (error) {
    return { error: "Не вдалося зберегти зміни, спробуй ще раз." };
  }

  return { ok: true };
}

export async function toggleTaskComplete(
  taskId: string,
  nextStatus: TaskStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("tasks")
    .update(nextStatus === "completed" ? { status: nextStatus, is_seeded: false } : { status: nextStatus })
    .eq("id", taskId);

  if (error) {
    return { error: "Не вдалося оновити задачу." };
  }

  return { ok: true };
}

export async function releaseTask(taskId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ released_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    return { error: "Не вдалося оновити задачу." };
  }

  return { ok: true };
}

export async function restoreTask(taskId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ released_at: null })
    .eq("id", taskId);

  if (error) {
    return { error: "Не вдалося оновити задачу." };
  }

  return { ok: true };
}

export async function updateResourceStatus(
  status: ResourceStatus,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("users")
    .update({ current_resource_status: status })
    .eq("id", user.id);

  if (error) {
    return { error: "Не вдалося зберегти стан ресурсу." };
  }

  return { ok: true };
}

export async function finishFocusSession(
  taskId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed", is_seeded: false })
    .eq("id", taskId);

  if (error) {
    return { error: "Не вдалося завершити задачу." };
  }

  return { ok: true };
}

export async function leaveFocusSession(
  taskId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase.from("tasks").update({ is_seeded: true }).eq("id", taskId);

  if (error) {
    return { error: "Не вдалося зберегти прогрес." };
  }

  return { ok: true };
}

export async function createProject(
  name: string,
): Promise<{ project: DbProject } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Назва проєкту не може бути порожньою." };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name: trimmed })
    .select()
    .single();

  if (error || !data) {
    return { error: "Не вдалося створити проєкт, спробуй ще раз." };
  }

  return { project: data as DbProject };
}

export async function updateProjectName(
  projectId: string,
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { error: "Назва проєкту не може бути порожньою." };
  }

  const { error } = await supabase
    .from("projects")
    .update({ name: trimmed })
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Не вдалося перейменувати проєкт, спробуй ще раз." };
  }

  return { ok: true };
}

export async function deleteProject(
  projectId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  // Tasks in this project keep their history — the FK is ON DELETE SET NULL,
  // so they fall back to "Без проєкту" instead of being removed.
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Не вдалося видалити проєкт, спробуй ще раз." };
  }

  return { ok: true };
}

export async function parseTaskWithAI(rawText: string): Promise<ParseTaskResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, rawText };
  }

  return parseTaskForUser(supabase, user.id, rawText);
}

export async function generateTelegramLinkCode(
  forceNew = false,
): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  if (!forceNew) {
    const { data: existing } = await supabase
      .from("users")
      .select("telegram_link_code, telegram_link_code_expires_at")
      .eq("id", user.id)
      .single();

    if (
      existing?.telegram_link_code &&
      existing.telegram_link_code_expires_at &&
      new Date(existing.telegram_link_code_expires_at) > new Date()
    ) {
      return {
        code: existing.telegram_link_code,
        expiresAt: existing.telegram_link_code_expires_at,
      };
    }
  }

  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60_000).toISOString();

  const { error } = await supabase
    .from("users")
    .update({ telegram_link_code: code, telegram_link_code_expires_at: expiresAt })
    .eq("id", user.id);

  if (error) {
    return { error: "Не вдалося згенерувати код, спробуй ще раз." };
  }

  return { code, expiresAt };
}

export async function disconnectTelegram(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { error } = await supabase
    .from("users")
    .update({ telegram_chat_id: null })
    .eq("id", user.id);

  if (error) {
    return { error: "Не вдалося відключити Telegram, спробуй ще раз." };
  }

  return { ok: true };
}

export async function updateDisplayName(
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const trimmed = name.trim();

  const { error } = await supabase
    .from("users")
    .update({ display_name: trimmed || null })
    .eq("id", user.id);

  if (error) {
    return { error: "Не вдалося зберегти ім'я, спробуй ще раз." };
  }

  return { ok: true };
}

export async function updatePassword(
  password: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  if (password.length < 6) {
    return { error: "Пароль має містити щонайменше 6 символів." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: mapAuthError(error.message) };
  }

  return { ok: true };
}
