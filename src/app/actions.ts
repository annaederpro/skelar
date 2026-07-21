"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseTaskWithOpenRouter, type ParseTaskResult } from "@/lib/ai/parse-task";
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
}): Promise<{ task: DbTask } | { error: string }> {
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

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: input.title,
      energy_level: input.energyLevel,
      duration_minutes: input.durationMinutes,
      project_id: input.projectId ?? null,
      priority: input.priority ?? 4,
      due_date: input.dueDate ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return { error: "Не вдалося додати задачу, спробуй ще раз." };
  }

  return { task: data as DbTask };
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
