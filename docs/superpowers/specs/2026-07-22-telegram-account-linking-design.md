# Per-user Telegram account linking — design spec

## Context

The Telegram voice/text capture feature
(`docs/superpowers/specs/2026-07-21-telegram-voice-capture-design.md`)
shipped with a single hardcoded owner: `/link <secret>` compares against
one static `TELEGRAM_LINK_SECRET` env var and always writes
`telegram_chat_id` onto the one `public.users` row matching
`TELEGRAM_OWNER_EMAIL`. That was an explicit non-goal-scoped decision for
the first pass ("Multi-user linking... not built here").

coralQ has multiple real accounts in `public.users` today. This spec
replaces the static single-owner secret with a real per-user linking flow,
reachable from a new in-app Settings page, so any logged-in user can
connect their own Telegram without an env var or a manually-shared code.

There is currently no Settings page, no 5th nav tab beyond
Сьогодні/Незабаром/Всі задачі/Мій акваріум, and the header only has the
logo, resource toggle, and sign-out icon.

## Decisions locked with the user before writing this spec

- **Scope**: full per-user linking, not just a UI wrapper around the
  static secret. Any logged-in user generates their own code tied to their
  own `user_id`.
- **UI placement**: a new `/settings` page, reachable via a small gear icon
  in the header next to sign-out — not a 5th bottom-nav tab, not a modal.
- **Connect UX**: tap-through Telegram deep link
  (`t.me/<bot>?start=<code>`) as the primary path — the code rides in the
  `/start` payload, so opening the link and tapping "Start" in Telegram
  links the account with no typing. A manual "or send `/link <code>`
  yourself" fallback stays visible below the button (covers desktop
  browsers without Telegram installed, or retyping from a different
  device).

## Non-goals (this pass)

- Removing the manual `/link <code>` command — it stays as the fallback
  path for the deep link, sharing the same verification logic.
- Any change to how the bot parses/inserts tasks once linked — this spec
  only touches how `telegram_chat_id` gets set.
- Rate-limiting code generation or guarding against a user spamming
  "generate new code" — low-stakes for a personal-scale app; each
  generation just overwrites the previous code, so spamming only
  invalidates your own prior code, not anyone else's.
- Showing which Telegram account/username is connected (e.g. "@username")
  beyond a plain connected/not-connected state — `telegram_chat_id` is a
  numeric ID, not a fetched profile; out of scope for this pass.

## Architecture and data flow

```
Settings page (Server Component, /settings)
  reads current user's telegram_chat_id (cookie-authed client)
       │
       ├─ connected → "✅ Telegram підключено" + Відключити button
       │              (disconnectTelegram Server Action)
       │
       └─ not connected → <TelegramConnectCard/> (client component)
              │
              ├─ on mount: generateTelegramLinkCode() [Server Action]
              │     reuses the existing code if one is still unexpired
              │     (idempotent) — only writes a *new* telegram_link_code
              │     + telegram_link_code_expires_at (+15 min) if none
              │     exists or the stored one has expired
              │
              └─ renders:
                    "Під'єднати Telegram 🐠" → t.me/<bot>?start=<code>
                    "або напиши /link <код> сама" + copy button
                    "код дійсний 15 хв" (+ "Згенерувати новий" if expired)

Telegram: tap deep link → bot chat opens → tap Start
   → /start with payload <code>
        │
        ▼
   grammY: payload present?
        │
        ├─ yes → tryLinkChat(admin, chatId, code) [shared helper,
        │        also used by /link]:
        │        look up users where telegram_link_code = code AND
        │        telegram_link_code_expires_at > now()
        │          match → set telegram_chat_id, clear both code
        │                  columns, reply "✅ Прив'язано!"
        │          no match/expired → "Код недійсний або застарів.
        │                  Згенеруй новий код у coralQ."
        │
        └─ no payload → existing greeting, now pointing at Settings
                         instead of a static secret

/link <code> command → same tryLinkChat() helper (manual fallback,
                        unchanged interaction, new lookup logic)
```

This fully replaces `TELEGRAM_LINK_SECRET` and `TELEGRAM_OWNER_EMAIL` —
both are removed from `.env.local.example` and from `bot.ts`. The
`telegram_chat_id`-based lookup used everywhere else in the bot
(`lookupLinkedUserId` in the voice/text handlers) is unchanged.

## Database

New migration `supabase/migrations/0005_telegram_link_code.sql`:

```sql
alter table public.users
  add column if not exists telegram_link_code text;
alter table public.users
  add column if not exists telegram_link_code_expires_at timestamptz;
```

Both nullable, no default, no index needed (lookups are by
`telegram_link_code` equality on a small `users` table — no scale concern
at this app's size). Regenerating a code overwrites both columns,
implicitly invalidating any code generated earlier. A successful link
clears both back to `null`, so a used code can never be replayed even
inside its 15-minute window.

## New/changed code

| File | Change |
|---|---|
| `supabase/migrations/0005_telegram_link_code.sql` | New — see above. |
| `src/types/gentle.ts` | `DbUser` gets `telegram_link_code: string \| null` and `telegram_link_code_expires_at: string \| null`. |
| `src/lib/telegram/link-code.ts` | New. `generateLinkCode(): string` (8 chars, uppercase `A-Z` + digits `2-9`, excludes `0/O/1/I` to avoid visual ambiguity when typed manually) and `LINK_CODE_TTL_MINUTES = 15`. |
| `src/app/actions.ts` | Two new exports: `generateTelegramLinkCode()` and `disconnectTelegram()` (see below). |
| `src/lib/telegram/bot.ts` | `/link` and `/start` both route through a new shared `tryLinkChat(admin, chatId, code): Promise<boolean>` helper. The static-secret branch is deleted entirely. |
| `.env.local.example` | Remove `TELEGRAM_LINK_SECRET` / `TELEGRAM_OWNER_EMAIL`; add `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`. |
| `src/components/gentle/app-shell.tsx` | Header gains a gear icon (`Settings` from `lucide-react`, matching the existing `LogOut` icon style) linking to `/settings`. |
| `src/app/(app)/settings/page.tsx` | New Server Component — the page described above. |
| `src/components/gentle/telegram-connect-card.tsx` | New client component — the not-connected state UI described above. |

## Server Actions

```ts
export async function generateTelegramLinkCode(
  forceNew = false,
): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Сесія закінчилась, увійди ще раз." };

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
      // Reuse the still-valid code — a page remount (closing/reopening the
      // tab) between generating a code and tapping the Telegram link must
      // not silently invalidate the one already in flight.
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

  if (error) return { error: "Не вдалося згенерувати код, спробуй ще раз." };
  return { code, expiresAt };
}

export async function disconnectTelegram(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Сесія закінчилась, увійди ще раз." };

  const { error } = await supabase
    .from("users")
    .update({ telegram_chat_id: null })
    .eq("id", user.id);

  if (error) return { error: "Не вдалося відключити Telegram, спробуй ще раз." };
  return { ok: true };
}
```

Both use the existing cookie-authenticated `createClient()` — RLS already
allows a user to update their own `users` row (`"Users can update own
profile"` policy from migration `0001`), so no admin client is needed on
the app side. The admin client is still what the *bot* uses to look up and
write `telegram_chat_id`/clear the code, same as today.

## Bot changes

```ts
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
    .update({ telegram_chat_id: String(chatId), telegram_link_code: null, telegram_link_code_expires_at: null })
    .eq("id", data.id);

  return !error;
}
```

- `bot.command("link", ...)`: `ctx.match` is the code (trimmed); calls
  `tryLinkChat`; success → "✅ Прив'язано! Тепер надсилай голосові або
  текстові задачі."; failure → "Код недійсний або застарів. Згенеруй новий
  код у coralQ.".
- `bot.command("start", ...)`: if `ctx.match` is non-empty, treat it
  exactly like `/link`'s argument (same messages, same `tryLinkChat` call).
  If empty, show the existing greeting, with its "Спочатку прив'яжи
  акаунт" line now saying "Відкрий Налаштування → Під'єднати Telegram у
  coralQ" instead of "/link <код>".
- The old `TELEGRAM_LINK_SECRET`/`TELEGRAM_OWNER_EMAIL`-based branch in the
  current `/link` handler is deleted, not kept as a fallback — this is a
  full replacement, not an addition.

## UI

**`src/app/(app)/settings/page.tsx`** (Server Component):
- `createClient()` → `auth.getUser()` → redirect to `/login` if absent
  (same guard pattern as other `(app)` pages).
- Fetch `telegram_chat_id` for that user.
- Render a simple page: heading "Налаштування", then either the connected
  state (inline, no separate component needed — it's static) or
  `<TelegramConnectCard />`.

**`src/components/gentle/telegram-connect-card.tsx`** (client component):
- On mount, calls `generateTelegramLinkCode()` (no `forceNew` — reuses an
  in-flight code if one is still valid); stores `{ code, expiresAt }` in
  state. Loading state while pending.
- Renders the deep link as a plain anchor:
  `href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}?start=${code}`}`
  styled as a prominent button, `target="_blank"`.
- Below it, smaller text: `"або напиши "` + a `<code>` chip showing
  `/link {code}` + a copy-to-clipboard icon button (`navigator.clipboard`,
  same pattern as any existing copy affordance in the app — none exists
  yet, so this is the first; keep it a plain button + `lucide-react`'s
  `Copy`/`Check` icon swap on click, no new dependency).
- A countdown-free expiry note: `"код дійсний 15 хвилин"`. If the user
  clicks the deep link/copies after it's expired, the *bot's* reply
  ("Код недійсний...") is the actual source of truth — the page doesn't
  try to track elapsed time client-side. A "Згенерувати новий код" text
  button calls `generateTelegramLinkCode(true)` (forces a fresh code even
  if the current one is still valid) and replaces the shown code.

**`src/components/gentle/app-shell.tsx`**: add a `Settings` icon
(`lucide-react`) `<Link href="/settings">` in `AppHeader`, next to the
existing sign-out `<LogOut>` button, same `text-ink-soft
hover:text-ink` styling.

## Error handling

| Failure | Behavior |
|---|---|
| `generateTelegramLinkCode` called while logged out | `{ error }` — page's fetch already redirects logged-out users to `/login`, so this is defense-in-depth, not a reachable UI state |
| Code generation DB write fails | Card shows inline "Не вдалося згенерувати код, спробуй ще раз." with a retry button |
| `/link <code>` or `/start <code>` with wrong/expired code | "Код недійсний або застарів. Згенеруй новий код у coralQ." — no DB write |
| `/link`/`/start` with a code that's valid but belongs to a *different already-linked* chat scenario (user regenerates and links from a second device) | Allowed — linking just overwrites `telegram_chat_id` on the same `users` row; a user relinking from a new device/chat is expected, not an error |
| Disconnect DB write fails | Inline "Не вдалося відключити Telegram, спробуй ще раз." |
| User not logged in and somehow lands on `/settings` | Redirected to `/login`, same as every other `(app)` route |

## Testing

No test runner in this repo (established convention) — manual
verification:

1. Log in as a user with no `telegram_chat_id`, visit `/settings` → see
   the connect card with a generated code and working deep link.
2. Tap the deep link on a phone with Telegram installed → bot opens →
   tap Start → "✅ Прив'язано!" reply → reload `/settings` → now shows
   connected state.
3. Manually send `/link <code>` (freshly generated, not yet used) from a
   different device/session → also links successfully (proves the
   fallback path uses the same code).
4. Send `/link` or open the deep link with an expired/already-used code →
   "Код недійсний або застарів."
5. Click "Відключити" → `telegram_chat_id` cleared → page reverts to the
   not-connected state → sending a task message afterward gets "Спочатку
   напиши /link" again.
6. "Згенерувати новий код" → old code stops working, new one works.

## Environment / secrets

- Remove: `TELEGRAM_LINK_SECRET`, `TELEGRAM_OWNER_EMAIL` (from
  `.env.local.example`, from Vercel, and from `.env.local` — no longer
  read anywhere).
- Add: `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` — public by design (a Telegram
  bot's username is part of its public profile URL, not a secret), read
  client-side by `TelegramConnectCard` to build the deep link.

## Self-authored decisions (assumptions — user may veto at spec review)

- Code alphabet excludes `0/O/1/I` — a small, low-risk usability choice
  for the manual-fallback path (deep-link taps don't care, but a
  hand-typed `/link` command benefits from unambiguous characters).
- 15-minute expiry — generous enough to not be annoying, short enough that
  a stale code isn't a standing risk; easy to tune later (one constant).
- No rate limiting on code generation (see Non-goals) — acceptable at this
  app's scale; each generation only invalidates the same user's own prior
  code.
- Settings page has no other content yet beyond the Telegram card — it's
  a single-purpose page for now, which is fine since nothing else needs a
  settings home currently.
