# Auth + Real Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory seed-data prototype (`SEED_TASKS` in `src/app/page.tsx`) with real Supabase Auth (email+password) and real reads/writes against the existing `users`/`tasks` schema, with route protection via middleware.

**Architecture:** `src/app/page.tsx` becomes an `async` Server Component that fetches the signed-in user's tasks and resource status via the server Supabase client, then hands them as props to a new client component `TaskDashboard`, which owns the existing interactive UI and calls new Server Actions (`src/app/actions.ts`) for every mutation. `src/middleware.ts` (backed by `src/lib/supabase/middleware.ts`) refreshes the Supabase session on every request and redirects unauthenticated visitors to `/login`.

**Tech Stack:** Next.js 16 App Router, React 19 (`useActionState`, `useTransition`), `@supabase/ssr`, `@supabase/supabase-js`, Tailwind v4, shadcn/ui.

## Global Constraints

- Auth method is email + password only. No OAuth, no magic link, no password reset — out of scope for this plan (per spec's "Поза межами обсягу").
- No database schema changes. `supabase/migrations/0001_init.sql` already has everything needed (`users`, `tasks`, RLS policies, the `on_auth_user_created` trigger).
- No `revalidatePath` / server-driven refetch. Mutations return a result object; the client component updates its own `useState` (optimistic update, roll back on error) — matches the existing prototype's interaction model.
- All user-facing copy is in Ukrainian, soft/non-alarming tone (rose-tinted but not harsh error text — e.g. `text-rose-600` on a light background, never a hard red alert box). Follow the existing tone in `src/components/gentle/depleted-banner.tsx`.
- Every Server Action creates its own `createClient()` from `src/lib/supabase/server.ts` and relies on RLS for authorization — do not add manual `user_id` ownership checks beyond what's needed to scope inserts (RLS already blocks cross-user reads/writes).
- **No automated test framework exists in this repo** (confirmed: `package.json` has no `jest`/`vitest`/`@testing-library/*`, no test script beyond `lint`). Do not add one as a side effect of this plan. Verification for every task is: `npx tsc --noEmit` (must report nothing), `npm run lint` (must report nothing), and a manual check against the running dev server. This mirrors how Block 1 (initial scaffold) was verified.
- Live browser verification against a real Supabase project requires `.env.local` to contain real project keys (Task 1). Tasks 2–5 (writing code) do not require live keys to pass their `tsc`/`lint` checks — only Task 6 (end-to-end pass) does.

---

## Task 1: Configure Supabase project environment variables

**This task is manual — the user must run it themselves; do not delegate it to a subagent, which has no access to the user's Supabase dashboard.**

**Files:**
- Create: `.env.local` (git-ignored; copy from `.env.local.example`)

**Interfaces:**
- Produces: a running Supabase project reachable via `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, with migration `supabase/migrations/0001_init.sql` already applied, that every later task's live verification depends on.

- [ ] **Step 1: Copy the example env file**

```bash
cp .env.local.example .env.local
```

- [ ] **Step 2: Fill in real values**

Open the Supabase dashboard for your project → Project Settings → API, and copy:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (not used by this plan, but fill it in now — Block 4's Telegram bot will need it)

Leave `GEMINI_API_KEY` and `TELEGRAM_BOT_TOKEN` blank — not needed yet.

- [ ] **Step 3: Apply the schema migration (if not already applied)**

In the Supabase SQL Editor, run the contents of `supabase/migrations/0001_init.sql`. If you already ran it in a previous session, skip this step.

- [ ] **Step 4: (Recommended for local testing) Disable email confirmation**

Supabase Dashboard → Authentication → Providers → Email → turn off "Confirm email". This lets you sign up and log in immediately without a real inbox. Re-enable before shipping to real users.

- [ ] **Step 5: Verify the dev server can start with the new env**

```bash
npm run dev
```

Expected: server starts on port 3000 with no `NEXT_PUBLIC_SUPABASE_URL is not defined` type errors in the terminal. Stop the server after confirming (Ctrl+C) — later tasks will start it again for their own checks.

---

## Task 2: Auth Server Actions + login page

**Files:**
- Create: `src/app/actions.ts`
- Create: `src/components/gentle/auth-form.tsx`
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/server.ts` (returns `Promise<SupabaseClient>`, already exists from Block 1).
- Produces (for Task 3, 4, 5 to import from `@/app/actions`):
  - `export type AuthFormState = { error: string | null; message: string | null }`
  - `export async function signIn(prevState: AuthFormState, formData: FormData): Promise<AuthFormState>`
  - `export async function signUp(prevState: AuthFormState, formData: FormData): Promise<AuthFormState>`
  - `export async function signOut(): Promise<void>` (always redirects, never returns normally)

- [ ] **Step 1: Create `src/app/actions.ts` with the auth actions**

```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
```

- [ ] **Step 2: Create `src/components/gentle/auth-form.tsx`**

```tsx
"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = { error: null, message: null };

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>

        {state.error && <p className="text-sm text-rose-600">{state.error}</p>}
        {state.message && <p className="text-sm text-emerald-600">{state.message}</p>}

        <Button type="submit" disabled={isPending} className="rounded-full">
          {mode === "signin" ? "Увійти" : "Зареєструватися"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        {mode === "signin" ? "Немає акаунту? Зареєструватися" : "Вже є акаунт? Увійти"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/login/page.tsx`**

```tsx
import { AuthForm } from "@/components/gentle/auth-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Gentle Productivity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Бережний таск-менеджер</p>
      </div>
      <AuthForm />
    </main>
  );
}
```

- [ ] **Step 4: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors.

- [ ] **Step 5: Manual verification (requires Task 1 done)**

```bash
npm run dev
```

Open `http://localhost:3000/login` in a browser. Confirm:
- The form renders with Email/Password fields and an "Увійти" button.
- Clicking "Немає акаунту? Зареєструватися" switches the button to "Зареєструватися" and the toggle text to "Вже є акаунт? Увійти".
- Submitting sign-up with a new email + a 6+ character password either redirects to `/` (email confirmation disabled) or shows the green "Перевір пошту..." message (email confirmation enabled).
- Submitting sign-in with a wrong password shows "Невірний email або пароль." in rose text, form stays on `/login`.

Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add src/app/actions.ts src/components/gentle/auth-form.tsx src/app/login/page.tsx
git commit --no-gpg-sign -m "feat: add email/password auth actions and login page"
```

---

## Task 3: Route protection middleware

**Files:**
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` (already in `.env.local` from Task 1); `/login` route (already exists from Task 2).
- Produces: every request to a non-`/login`, non-static, non-`/api` route without a valid session gets redirected to `/login`; every request to `/login` with a valid session gets redirected to `/`.

- [ ] **Step 1: Create `src/lib/supabase/middleware.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Create `src/middleware.ts`**

```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors.

- [ ] **Step 4: Manual verification (requires Task 1 done)**

```bash
npm run dev
```

Confirm:
- Open `http://localhost:3000/` in a fresh/incognito browser window (no session) → redirected to `/login`.
- Log in via the form from Task 2 → redirected to `/` (still shows the old seed-data UI at this point — that's expected, Task 5 replaces it).
- With a valid session, open `http://localhost:3000/login` directly → redirected to `/`.

Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/middleware.ts src/middleware.ts
git commit --no-gpg-sign -m "feat: protect routes with Supabase session middleware"
```

---

## Task 4: Task and profile Server Actions

**Files:**
- Modify: `src/app/actions.ts` (append to the file created in Task 2)

**Interfaces:**
- Consumes: `DbTask`, `EnergyLevel`, `ResourceStatus`, `TaskStatus` from `src/types/gentle.ts` (already exist from Block 1); `createClient()` from `src/lib/supabase/server.ts`.
- Produces (for Task 5 to import from `@/app/actions`):
  - `export async function addTask(input: { title: string; energyLevel: EnergyLevel; durationMinutes: number }): Promise<{ task: DbTask } | { error: string }>`
  - `export async function toggleTaskComplete(taskId: string, nextStatus: TaskStatus): Promise<{ ok: true } | { error: string }>`
  - `export async function updateResourceStatus(status: ResourceStatus): Promise<{ ok: true } | { error: string }>`

- [ ] **Step 1: Append the data actions to `src/app/actions.ts`**

Add this import at the top of the existing file (alongside the existing imports):

```ts
import type { DbTask, EnergyLevel, ResourceStatus, TaskStatus } from "@/types/gentle";
```

Append at the end of the file:

```ts
export async function addTask(input: {
  title: string;
  energyLevel: EnergyLevel;
  durationMinutes: number;
}): Promise<{ task: DbTask } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Сесія закінчилась, увійди ще раз." };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: input.title,
      energy_level: input.energyLevel,
      duration_minutes: input.durationMinutes,
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
  const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", taskId);

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
```

- [ ] **Step 2: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors. (These actions aren't wired into any UI yet — Task 5 does that — so there's no manual browser check for this task on its own.)

- [ ] **Step 3: Commit**

```bash
git add src/app/actions.ts
git commit --no-gpg-sign -m "feat: add task and resource-status Server Actions"
```

---

## Task 5: Wire real data into the main screen

**Files:**
- Modify: `src/app/page.tsx` (full rewrite — currently 106 lines of client-side seed-data logic from Block 1)
- Create: `src/components/gentle/task-dashboard.tsx`

**Interfaces:**
- Consumes: `addTask`, `toggleTaskComplete`, `updateResourceStatus`, `signOut` from `@/app/actions` (Tasks 2 & 4); `createClient()` from `@/lib/supabase/server.ts`; existing components `ResourceStatusToggle`, `DepletedBanner`, `TaskList`, `QuickAddTaskForm` (all unchanged, from Block 1).
- Produces: `TaskDashboard` component with props `{ initialTasks: DbTask[]; initialResourceStatus: ResourceStatus }` — no other task depends on this, it's the leaf of this plan.

- [ ] **Step 1: Replace `src/app/page.tsx` entirely**

```tsx
import { createClient } from "@/lib/supabase/server";
import { TaskDashboard } from "@/components/gentle/task-dashboard";
import type { DbTask, ResourceStatus } from "@/types/gentle";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware (src/middleware.ts) redirects unauthenticated requests to
  // /login before this component ever renders, so `user` is always present here.
  const userId = user!.id;

  const [{ data: tasks }, { data: profile }] = await Promise.all([
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("users").select("current_resource_status").eq("id", userId).single(),
  ]);

  return (
    <TaskDashboard
      initialTasks={(tasks ?? []) as DbTask[]}
      initialResourceStatus={(profile?.current_resource_status ?? "normal") as ResourceStatus}
    />
  );
}
```

- [ ] **Step 2: Create `src/components/gentle/task-dashboard.tsx`**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { ResourceStatusToggle } from "@/components/gentle/resource-status-toggle";
import { DepletedBanner } from "@/components/gentle/depleted-banner";
import { TaskList } from "@/components/gentle/task-list";
import { QuickAddTaskForm } from "@/components/gentle/quick-add-task-form";
import { addTask, toggleTaskComplete, updateResourceStatus, signOut } from "@/app/actions";
import type { DbTask, EnergyLevel, ResourceStatus } from "@/types/gentle";

interface TaskDashboardProps {
  initialTasks: DbTask[];
  initialResourceStatus: ResourceStatus;
}

export function TaskDashboard({ initialTasks, initialResourceStatus }: TaskDashboardProps) {
  const [resourceStatus, setResourceStatus] = useState<ResourceStatus>(initialResourceStatus);
  const [tasks, setTasks] = useState<DbTask[]>(initialTasks);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isDepleted = resourceStatus === "depleted";

  const visibleTasks = useMemo(
    () => (isDepleted ? tasks.filter((task) => task.energy_level < 3) : tasks),
    [tasks, isDepleted],
  );

  const handleResourceStatusChange = (next: ResourceStatus) => {
    const previous = resourceStatus;
    setResourceStatus(next);
    setErrorMessage(null);
    startTransition(async () => {
      const result = await updateResourceStatus(next);
      if ("error" in result) {
        setResourceStatus(previous);
        setErrorMessage(result.error);
      }
    });
  };

  const handleToggleComplete = (task: DbTask) => {
    const nextStatus = task.status === "completed" ? "todo" : "completed";
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    setErrorMessage(null);
    startTransition(async () => {
      const result = await toggleTaskComplete(task.id, nextStatus);
      if ("error" in result) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
        setErrorMessage(result.error);
      }
    });
  };

  const handleAddTask = (input: {
    title: string;
    energyLevel: EnergyLevel;
    durationMinutes: number;
  }) => {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await addTask(input);
      if ("error" in result) {
        setErrorMessage(result.error);
        return;
      }
      setTasks((prev) => [result.task, ...prev]);
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 bg-background px-4 py-6">
      <header className="flex flex-col items-center gap-4">
        <div className="flex w-full items-center justify-between">
          <span className="size-5" aria-hidden />
          <h1 className="text-lg font-semibold">Сьогодні</h1>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Вийти"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-5" />
            </button>
          </form>
        </div>
        <ResourceStatusToggle value={resourceStatus} onChange={handleResourceStatusChange} />
      </header>

      {isDepleted && <DepletedBanner />}

      {errorMessage && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">
          {errorMessage}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <TaskList tasks={visibleTasks} onToggleComplete={handleToggleComplete} />
      </section>

      <section className="mt-auto">
        <QuickAddTaskForm onAdd={handleAddTask} disabledEnergyLevels={isDepleted ? [3] : []} />
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors.

- [ ] **Step 4: Manual verification (requires Task 1 done, and Tasks 2–4 committed)**

```bash
npm run dev
```

Log in (or sign up) at `http://localhost:3000/login`, then on `/` confirm:
- Task list is empty on a brand-new account (no more hardcoded seed tasks).
- Adding a task via the quick-add form makes it appear in the list; reload the page (`F5`) — it's still there (real DB row).
- Toggling the resource status to "Виснажена" hides any task with `energy_level = 3`; reload — the resource status is still "Виснажена" (read from `users.current_resource_status`).
- Clicking the checkbox on a task marks it complete (strikethrough); reload — it's still marked complete.
- Clicking the logout icon redirects to `/login`; then opening `http://localhost:3000/` directly redirects back to `/login` (middleware still protecting the route).

Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/gentle/task-dashboard.tsx
git commit --no-gpg-sign -m "feat: wire main screen to real Supabase data via Server Actions"
```

---

## Task 6: Full end-to-end verification pass

**Files:** none (verification only)

**Interfaces:** none — this task exercises everything built in Tasks 1–5 together.

- [ ] **Step 1: Run the full check suite**

```bash
npx tsc --noEmit
npm run lint
```

Expected: both report no errors.

- [ ] **Step 2: Walk the spec's verification checklist end-to-end**

```bash
npm run dev
```

In a fresh incognito window against `http://localhost:3000`:
1. Register a brand-new user at `/login` → redirected to `/`, task list is empty (confirms the `on_auth_user_created` trigger created the `public.users` row — if this fails, sign-in will error because there's no matching profile row for the resource-status query).
2. Log out, log back in with the same credentials → sees the same (still empty, or whatever was added) task list.
3. Add a task, reload with `F5` → task persists.
4. Toggle resource status to "Виснажена", reload with `F5` → status persists and any P3/energy-3 task stays hidden.
5. Log out → redirected to `/login`. Try opening `/` directly (paste URL, hit enter) → redirected back to `/login`.

- [ ] **Step 3: Report results**

If every check in Step 2 passes, this sub-project (1 of 4) is complete. If anything fails, note which numbered check failed and the exact error text/behavior observed before moving on — do not proceed to sub-project 2 (Projects/Priority schema + navigation) with a known-broken auth layer.
