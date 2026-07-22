# Per-user Telegram Account Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static single-owner `/link <secret>` flow with per-user Telegram linking: any logged-in coralQ user generates their own short-lived code from a new Settings page and connects via a tap-through Telegram deep link (with manual `/link <code>` as a fallback).

**Architecture:** Two new nullable columns on `public.users` hold a per-user one-time code + expiry. A cookie-authenticated Server Action generates/reuses the code (RLS already permits users to update their own row). The bot's `/link` and the payload-carrying `/start` deep link both route through one shared `tryLinkChat` helper that looks the code up via the admin client, sets `telegram_chat_id`, and clears the code. A new `/settings` page (under the existing `(app)` route group, so it inherits the `AppShell`/auth-guarding layout for free) renders either the connected state or a `TelegramConnectCard` client component; a new gear icon in the header links to it.

**Tech Stack:** Existing stack only — no new dependencies. Next.js Server Actions, Supabase (cookie client for the app side, admin client for the bot side, same as the rest of the app), `lucide-react` (`Settings`, `Copy`, `Check` icons — already installed, confirmed present in `node_modules/lucide-react/dist/esm/icons/`).

**Spec:** `docs/superpowers/specs/2026-07-22-telegram-account-linking-design.md`

## Global Constraints

- All user-facing copy is Ukrainian, matching existing tone (e.g. `"Сесія закінчилась, увійди ще раз."` in `src/app/actions.ts`).
- `(app)` route group pages don't redirect-to-login themselves — `src/middleware.ts` already redirects unauthenticated requests before any `(app)` page renders, so pages just do `const userId = user!.id;` (confirmed pattern in `src/app/(app)/inbox/page.tsx` and `src/app/(app)/layout.tsx`). Do not add a redundant redirect in the new Settings page.
- RLS already allows a user to update their own `users` row (`"Users can update own profile"` policy, migration `0001`) — no RLS changes needed for the new columns.
- The next unused migration number is `0006` (existing: `0001_init.sql` … `0005_task_release.sql`).
- No test runner exists in this repo; each task's gate is `npx tsc --noEmit` + `npm run lint`. Task 6 is manual verification.
- `TELEGRAM_LINK_SECRET` / `TELEGRAM_OWNER_EMAIL` are being fully replaced, not kept as a fallback — delete their usage, don't leave dead branches.
- Every commit: `git commit --no-gpg-sign` (pinentry cannot prompt in this environment).
- `src/app/actions.ts` currently also has `releaseTask`/`restoreTask` (added by a concurrent session) — leave those untouched; only add the two new exports described here.

---

### Task 1: Migration, type, and link-code helper

**Files:**
- Create: `supabase/migrations/0006_telegram_link_code.sql`
- Modify: `src/types/gentle.ts` (extend `DbUser`)
- Create: `src/lib/telegram/link-code.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (Tasks 2–3 rely on these): `generateLinkCode(): string`, `LINK_CODE_TTL_MINUTES: number` (both exported from `src/lib/telegram/link-code.ts`); `DbUser.telegram_link_code: string | null` and `DbUser.telegram_link_code_expires_at: string | null`.

- [ ] **Step 1: Create the migration**

```sql
alter table public.users
  add column if not exists telegram_link_code text;
alter table public.users
  add column if not exists telegram_link_code_expires_at timestamptz;
```

Save as `supabase/migrations/0006_telegram_link_code.sql`. Apply it to the
project's Supabase instance the same way prior migrations were applied
(the Supabase SQL editor, or however `0001`–`0005` were run — there is no
migration-runner script in this repo).

- [ ] **Step 2: Extend `DbUser` in `src/types/gentle.ts`**

```ts
export interface DbUser {
  id: string;
  email: string;
  current_resource_status: ResourceStatus;
  telegram_chat_id: string | null;
  // Added by migration 0006 (per-user Telegram linking). Non-null only
  // while a generated code is awaiting use; cleared on successful link.
  telegram_link_code: string | null;
  telegram_link_code_expires_at: string | null;
  created_at: string;
}
```

- [ ] **Step 3: Create `src/lib/telegram/link-code.ts`**

```ts
// 8 chars, uppercase letters + digits, excluding 0/O/1/I to avoid visual
// ambiguity when a code is typed by hand via the /link fallback.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateLinkCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export const LINK_CODE_TTL_MINUTES = 15;
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_telegram_link_code.sql src/types/gentle.ts src/lib/telegram/link-code.ts
git commit --no-gpg-sign -m "feat: add telegram_link_code columns and code-generation helper"
```

---

### Task 2: Server Actions — generate and disconnect

**Files:**
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `generateLinkCode`, `LINK_CODE_TTL_MINUTES` (Task 1).
- Produces (Task 4 relies on these exact signatures):
  - `generateTelegramLinkCode(forceNew?: boolean): Promise<{ code: string; expiresAt: string } | { error: string }>`
  - `disconnectTelegram(): Promise<{ ok: true } | { error: string }>`

- [ ] **Step 1: Add the import**

Add alongside the existing imports at the top of `src/app/actions.ts`:

```ts
import { generateLinkCode, LINK_CODE_TTL_MINUTES } from "@/lib/telegram/link-code";
```

- [ ] **Step 2: Add `generateTelegramLinkCode`**

Append to `src/app/actions.ts` (after `parseTaskWithAI`, at the end of the file):

```ts
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
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions.ts
git commit --no-gpg-sign -m "feat: add generateTelegramLinkCode and disconnectTelegram server actions"
```

---

### Task 3: Bot — shared tryLinkChat, rewired /link and /start, env cleanup

**Files:**
- Modify: `src/lib/telegram/bot.ts`
- Modify: `.env.local.example`

**Interfaces:**
- Consumes: nothing new (uses the `createAdminClient` already imported in `bot.ts`).
- Produces: no new exports — internal behavior change only. `createBot()`'s signature is unchanged.

- [ ] **Step 1: Add the shared `tryLinkChat` helper**

In `src/lib/telegram/bot.ts`, add this function after `lookupLinkedUserId` (which stays unchanged) and before `nextDayIso`:

```ts
// Shared by /link and /start's deep-link payload: looks up a user by an
// unexpired one-time code, links this chat to them, and clears the code
// so it can't be replayed.
async function tryLinkChat(
  admin: SupabaseClient,
  chatId: number,
  code: string,
): Promise<boolean> {
  const { data } = await admin
    .from("users")
    .select("id")
    .eq("telegram_link_code", code)
    .gt("telegram_link_code_expires_at", new Date().toISOString())
    .maybeSingle();

  if (!data) return false;

  const { error } = await admin
    .from("users")
    .update({
      telegram_chat_id: String(chatId),
      telegram_link_code: null,
      telegram_link_code_expires_at: null,
    })
    .eq("id", data.id);

  return !error;
}
```

- [ ] **Step 2: Rewrite the `/start` handler**

Replace the current `bot.command("start", ...)` block:

```ts
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Привіт! Я додаю задачі в coralQ 🐠\n" +
        "Надішли мені текст або голосове — розберу і збережу.\n" +
        "Спочатку прив'яжи акаунт: /link <код>",
    );
  });
```

with:

```ts
  bot.command("start", async (ctx) => {
    const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";

    if (payload) {
      const linked = await tryLinkChat(createAdminClient(), ctx.chat.id, payload);
      await ctx.reply(
        linked
          ? "✅ Прив'язано! Тепер надсилай голосові або текстові задачі."
          : "Код недійсний або застарів. Згенеруй новий код у coralQ.",
      );
      return;
    }

    await ctx.reply(
      "Привіт! Я додаю задачі в coralQ 🐠\n" +
        "Надішли мені текст або голосове — розберу і збережу.\n" +
        "Відкрий Налаштування → Під'єднати Telegram у coralQ, щоб прив'язати акаунт.",
    );
  });
```

- [ ] **Step 3: Rewrite the `/link` handler**

Replace the current `bot.command("link", ...)` block (the whole thing,
including the `TELEGRAM_LINK_SECRET`/`TELEGRAM_OWNER_EMAIL` branch):

```ts
  bot.command("link", async (ctx) => {
    const secret = process.env.TELEGRAM_LINK_SECRET;
    const ownerEmail = process.env.TELEGRAM_OWNER_EMAIL;
    const supplied = typeof ctx.match === "string" ? ctx.match.trim() : "";

    if (!secret || !ownerEmail || !supplied || supplied !== secret) {
      await ctx.reply("❌ Невірний код.");
      return;
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("users")
      .update({ telegram_chat_id: String(ctx.chat.id) })
      .eq("email", ownerEmail)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      await ctx.reply(MSG_GENERIC_FAILED);
      return;
    }

    await ctx.reply("✅ Прив'язано! Тепер надсилай голосові або текстові задачі.");
  });
```

with:

```ts
  bot.command("link", async (ctx) => {
    const code = typeof ctx.match === "string" ? ctx.match.trim() : "";
    if (!code) {
      await ctx.reply("Код недійсний або застарів. Згенеруй новий код у coralQ.");
      return;
    }

    const linked = await tryLinkChat(createAdminClient(), ctx.chat.id, code);
    await ctx.reply(
      linked
        ? "✅ Прив'язано! Тепер надсилай голосові або текстові задачі."
        : "Код недійсний або застарів. Згенеруй новий код у coralQ.",
    );
  });
```

- [ ] **Step 4: Update `.env.local.example`**

Remove the `TELEGRAM_LINK_SECRET=` and `TELEGRAM_OWNER_EMAIL=` lines and
add a public bot-username var (needed by Task 4's deep link). The
`# Telegram bot (Block 4)` section becomes:

```
# Telegram bot (Block 4)
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=
```

Also remove `TELEGRAM_LINK_SECRET` and `TELEGRAM_OWNER_EMAIL` from
`.env.local` and from the Vercel project's environment variables (no
longer read anywhere), and add `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` to both
— its value is the bot's public `@username` without the `@` (e.g.
`coralq_tasks_bot`, confirmed as this bot's actual username from earlier
`getMe` output).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass. `grep -n "TELEGRAM_LINK_SECRET\|TELEGRAM_OWNER_EMAIL" src/lib/telegram/bot.ts` should return nothing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/telegram/bot.ts .env.local.example
git commit --no-gpg-sign -m "feat: replace static Telegram link secret with per-user one-time codes"
```

---

### Task 4: TelegramConnectCard component

**Files:**
- Create: `src/components/gentle/telegram-connect-card.tsx`

**Interfaces:**
- Consumes: `generateTelegramLinkCode` (Task 2), `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` env var (Task 3).
- Produces (Task 5 relies on this): `<TelegramConnectCard />` — no props, self-contained client component.

- [ ] **Step 1: Create `src/components/gentle/telegram-connect-card.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { generateTelegramLinkCode } from "@/app/actions";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; code: string }
  | { status: "error"; message: string };

export function TelegramConnectCard() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    generateTelegramLinkCode().then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setState({ status: "error", message: result.error });
      } else {
        setState({ status: "ready", code: result.code });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const regenerate = async () => {
    setState({ status: "loading" });
    const result = await generateTelegramLinkCode(true);
    setState("error" in result ? { status: "error", message: result.error } : { status: "ready", code: result.code });
  };

  const copyCommand = async (code: string) => {
    await navigator.clipboard.writeText(`/link ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (state.status === "loading") {
    return <p className="text-[15px] text-ink-soft">Генерую код…</p>;
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[15px] text-coral">{state.message}</p>
        <button
          type="button"
          onClick={regenerate}
          className="self-start rounded-full bg-muted px-3 py-1.5 text-[13px] font-bold text-ink-soft"
        >
          Спробувати ще раз
        </button>
      </div>
    );
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const deepLink = `https://t.me/${botUsername}?start=${state.code}`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted p-4">
      <a
        href={deepLink}
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-sea-deep px-4 py-3 text-center text-[15px] font-bold text-white"
      >
        Під'єднати Telegram 🐠
      </a>
      <div className="flex items-center gap-2 text-[13px] text-ink-soft">
        <span>
          або напиши <code className="rounded bg-paper px-1.5 py-0.5">/link {state.code}</code>
        </span>
        <button
          type="button"
          aria-label="Скопіювати команду"
          onClick={() => copyCommand(state.code)}
          className="text-ink-soft transition-colors hover:text-ink"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <div className="flex items-center justify-between text-[12.5px] text-ink-soft">
        <span>код дійсний 15 хвилин</span>
        <button type="button" onClick={regenerate} className="font-bold underline">
          Згенерувати новий код
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/gentle/telegram-connect-card.tsx
git commit --no-gpg-sign -m "feat: add TelegramConnectCard component"
```

---

### Task 5: Settings page and header link

**Files:**
- Create: `src/app/(app)/settings/page.tsx`
- Modify: `src/components/gentle/app-shell.tsx`

**Interfaces:**
- Consumes: `TelegramConnectCard` (Task 4), `disconnectTelegram` (Task 2).
- Produces: route `/settings`; no new exports consumed elsewhere.

- [ ] **Step 1: Create `src/app/(app)/settings/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { SettingsTelegramSection } from "@/components/gentle/settings-telegram-section";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const { data: profile } = await supabase
    .from("users")
    .select("telegram_chat_id")
    .eq("id", userId)
    .single();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-semibold">Налаштування</h2>
      <SettingsTelegramSection initiallyConnected={Boolean(profile?.telegram_chat_id)} />
    </div>
  );
}
```

This introduces one more small client component (`SettingsTelegramSection`)
rather than branching connected/not-connected inline in the server page,
because the "Відключити" button needs client-side state to flip back to
the not-connected card without a full page reload. Add it now:

- [ ] **Step 2: Create `src/components/gentle/settings-telegram-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { disconnectTelegram } from "@/app/actions";
import { TelegramConnectCard } from "@/components/gentle/telegram-connect-card";

export function SettingsTelegramSection({ initiallyConnected }: { initiallyConnected: boolean }) {
  const [connected, setConnected] = useState(initiallyConnected);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async () => {
    setError(null);
    const result = await disconnectTelegram();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setConnected(false);
  };

  if (connected) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-muted p-4">
        <p className="text-[15px] font-bold text-ink">✅ Telegram підключено</p>
        {error && <p className="text-[13px] text-coral">{error}</p>}
        <button
          type="button"
          onClick={disconnect}
          className="self-start rounded-full bg-paper px-3 py-1.5 text-[13px] font-bold text-ink-soft"
        >
          Відключити
        </button>
      </div>
    );
  }

  return <TelegramConnectCard />;
}
```

- [ ] **Step 3: Add the header gear icon**

In `src/components/gentle/app-shell.tsx`, add `Settings` to the existing
`lucide-react` import:

```ts
import { LogOut, Settings } from "lucide-react";
```

Add `Link` from `next/link` (not currently imported in this file):

```ts
import Link from "next/link";
```

In `AppHeader`, add the gear icon next to the sign-out button. Replace:

```tsx
      <div className="flex w-full items-center justify-between">
        <Wordmark />
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Вийти"
            className="text-ink-soft transition-colors hover:text-ink"
          >
            <LogOut className="size-5" />
          </button>
        </form>
      </div>
```

with:

```tsx
      <div className="flex w-full items-center justify-between">
        <Wordmark />
        <div className="flex items-center gap-3">
          <Link href="/settings" aria-label="Налаштування" className="text-ink-soft transition-colors hover:text-ink">
            <Settings className="size-5" />
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              aria-label="Вийти"
              className="text-ink-soft transition-colors hover:text-ink"
            >
              <LogOut className="size-5" />
            </button>
          </form>
        </div>
      </div>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three pass (the build check matters here since it's a new route).

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/settings/page.tsx src/components/gentle/settings-telegram-section.tsx src/components/gentle/app-shell.tsx
git commit --no-gpg-sign -m "feat: add Settings page with Telegram connect/disconnect UI"
```

---

### Task 6: Manual verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1–5, deployed.

- [ ] **Step 1: Preview the Settings page locally**

Start the dev server (`preview_start`), log in, navigate to `/settings`.
Expected: not-connected state renders — a generated code, a
`https://t.me/<username>?start=<CODE>` link, the `/link <CODE>` fallback
text with a working copy button, and the 15-minute note.

- [ ] **Step 2: Local synthetic link test**

With the dev server running and a real `TELEGRAM_BOT_TOKEN` in
`.env.local` (already present from the prior Telegram feature), grab the
code shown on `/settings` and POST a synthetic `/start <code>` update at
`localhost:3000/api/telegram/webhook` with the correct
`X-Telegram-Bot-Api-Secret-Token` header, using a throwaway `chat.id`
(e.g. `999000555`) — mirroring the pattern used in the original Telegram
capture plan's Task 6. Then query `public.users` for that account's
`telegram_chat_id` and confirm it now equals `"999000555"`, and that
`telegram_link_code`/`telegram_link_code_expires_at` are both `null`.

- [ ] **Step 3: Expired/invalid code**

Repeat Step 2 with a made-up code that was never generated. Expected:
`telegram_chat_id` unchanged, and (if you have log access) a "Код
недійсний або застарів" reply attempt in the logs.

- [ ] **Step 4: Deploy and real device test**

Push to `main`, wait for the Vercel deploy, confirm
`NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, and (already-present)
`TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET` are set in Vercel's
Production environment — and confirm `TELEGRAM_LINK_SECRET`/
`TELEGRAM_OWNER_EMAIL` are removed there too. On a phone: open
`/settings` in the deployed app, tap "Під'єднати Telegram", confirm
Telegram opens to the bot with Start visible, tap it, confirm the
"✅ Прив'язано!" reply, then reload `/settings` and confirm it now shows
the connected state. Tap "Відключити", confirm it reverts, and confirm a
task message sent afterward gets "Спочатку напиши /link <код>." again.

- [ ] **Step 5: Regenerate-code check**

On `/settings` (not connected), note the code, click "Згенерувати новий
код", confirm a different code appears, and confirm the *old* code no
longer links (via `/link <old-code>` from the bot) while the new one does.
