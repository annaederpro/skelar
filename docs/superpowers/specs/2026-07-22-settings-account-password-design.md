# Settings page — Account & Password cards — design spec

## Context

The Settings page (`src/app/(app)/settings/page.tsx`) currently renders
exactly one thing: the Telegram connect/disconnect card. Visually the page
looks unfinished — no account info, no way to change your password, no
personalization. The user asked for the page to feel "more professional"
and "not so empty," specifically calling out password change and a way to
say "як до тебе звертатись" (how to address you).

There is currently no `display_name` (or equivalent) column on
`public.users`, no password-change action anywhere in the app, and the
Settings page shows nothing about the account itself — not even the
email.

## Decisions locked with the user before writing this spec

- **Password change**: new password + confirm only. No "current password"
  re-entry field — relies on the user already holding a valid session,
  matching Supabase's default `auth.updateUser({ password })` pattern.
- **Display name**: stored and shown in Settings only. Not wired into the
  Telegram bot or anywhere else in this pass.
- **Email**: shown read-only in the new Account card. Not editable (email
  changes need a confirmation-email flow, which is out of scope).
- **Layout/order**: Обліковий запис (Account) → Пароль (Password) →
  Telegram, top to bottom. All three cards share one visual style.
- **Visual style**: new cards match the *existing Telegram card's* bespoke
  style (`rounded-2xl bg-muted p-4`, pill-shaped `bg-sea-deep text-white`
  buttons, `text-[15px]`/`text-[13px]` custom sizes, `ink`/`ink-soft`/
  `coral`/`sea-deep` color tokens) rather than the generic shadcn
  `Button`/`Label` used on the separate `/login` page — the two new cards
  sit directly next to the Telegram card on the same page, so matching its
  established style keeps the page visually cohesive. The shadcn `Input`
  is still used for text entry (already the established pattern for form
  fields elsewhere, e.g. task title/duration in `task-fields-form.tsx`),
  since it's background-transparent and sits cleanly on a muted card.

## Non-goals (this pass)

- Editing/changing the account email.
- Deleting the account.
- Using `display_name` anywhere outside the Settings page (bot greetings,
  header, etc.) — a later pass can wire it in once it exists.
- Requiring current-password confirmation before a password change.
- Rate-limiting password-change attempts — low-stakes for a personal-scale
  app, same reasoning as the existing Telegram code-generation non-goal.
- Any test suite — none exists in this repo; verification stays manual via
  the live preview, consistent with every other feature shipped so far.

## Database

New migration `supabase/migrations/0007_display_name.sql`:

```sql
alter table public.users
  add column if not exists display_name text;
```

Nullable, no default — `null` means "not set yet." No RLS change needed:
the existing `"Users can update own profile"` policy (migration `0001`,
`using (auth.uid() = id)`) already covers updates to any column on a row
the user owns, including a newly added one.

## New/changed code

| File | Change |
|---|---|
| `supabase/migrations/0007_display_name.sql` | New — see above. |
| `src/types/gentle.ts` | `DbUser` gets `display_name: string \| null`. |
| `src/app/actions.ts` | Two new exports: `updateDisplayName()` and `updatePassword()` (see below). |
| `src/app/(app)/settings/page.tsx` | Fetch `display_name` alongside `telegram_chat_id`; render the three cards in the new order. |
| `src/components/gentle/settings-account-section.tsx` | New client component — email (static) + editable display name + save. |
| `src/components/gentle/settings-password-section.tsx` | New client component — new/confirm password + save. |
| `src/components/gentle/settings-telegram-section.tsx` | Unchanged. |

## Server Actions

```ts
export async function updateDisplayName(
  name: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Сесія закінчилась, увійди ще раз." };

  const trimmed = name.trim();

  const { error } = await supabase
    .from("users")
    .update({ display_name: trimmed || null })
    .eq("id", user.id);

  if (error) return { error: "Не вдалося зберегти ім'я, спробуй ще раз." };
  return { ok: true };
}

export async function updatePassword(
  password: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Сесія закінчилась, увійди ще раз." };

  if (password.length < 6) {
    return { error: "Пароль має містити щонайменше 6 символів." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: mapAuthError(error.message) };
  return { ok: true };
}
```

Both reuse the existing cookie-authenticated `createClient()` — no admin
client needed, same as every other user-scoped action in this file.
`updatePassword` reuses the file's existing (unexported) `mapAuthError`
helper, which already maps Supabase's `"Password should be at least..."`
message to the Ukrainian string above; the explicit length check just
avoids a round-trip for the common case.

## UI

**`src/app/(app)/settings/page.tsx`** (Server Component):
- Extend the existing `users` select to `"telegram_chat_id, display_name"`.
- Render, in order: `<SettingsAccountSection email={user.email!}
  initialDisplayName={profile?.display_name ?? null} />`,
  `<SettingsPasswordSection />`, `<SettingsTelegramSection
  initiallyConnected={...} />` (unchanged).

**`src/components/gentle/settings-account-section.tsx`** (client
component):
- Card wrapper: `rounded-2xl bg-muted p-4`, `flex flex-col gap-3`.
- Heading: `"Обліковий запис"`, `text-[15px] font-bold text-ink`.
- Static row: label `"Пошта"` (`text-[13px] text-ink-soft`) + the email
  value (`text-[15px] text-ink`) — plain text, not an input.
- Editable field: shadcn `Input`, label `"Як до тебе звертатись?"`
  (plain `<label>`, styled `text-[13px] text-ink-soft`, not the shadcn
  `Label`, to match the rest of this card's bespoke type scale),
  `useState` initialized from `initialDisplayName ?? ""`.
- Save button: `"Зберегти"`, pill-shaped `rounded-full bg-sea-deep
  text-white`, `text-[13px] font-bold`, disabled while saving.
- On submit: calls `updateDisplayName(name)`; shows `text-coral` error
  inline on failure; on success shows a brief `"Збережено"` confirmation
  (`text-sea-deep`) that clears after ~2s (matching the existing
  copy-to-clipboard checkmark timeout pattern in `telegram-connect-card.tsx`).

**`src/components/gentle/settings-password-section.tsx`** (client
component):
- Card wrapper: same styling as the Account card.
- Heading: `"Пароль"`.
- Two shadcn `Input`s, `type="password"`: `"Новий пароль"` and `"Повтори
  пароль"`, both `minLength={6}`, `autoComplete="new-password"`.
- Client-side validation before calling the server: both fields non-empty,
  ≥6 chars, and equal — inline `text-coral` error if not (e.g. `"Паролі не
  співпадають"`), no server round-trip for this case.
- Save button: `"Змінити пароль"`, same pill style as the Account card's
  save button, disabled while saving.
- On submit: calls `updatePassword(password)`; inline `text-coral` error
  from the server on failure; on success, clears both fields and shows a
  `"Пароль оновлено"` confirmation (`text-sea-deep`), same ~2s-fade pattern
  as the Account card. No sign-out, no redirect — the existing session
  stays valid after a Supabase password change.

## Error handling

| Failure | Behavior |
|---|---|
| `updateDisplayName` called while logged out | `{ error }` — unreachable via UI since `(app)` routes already redirect logged-out users to `/login`; defense-in-depth only |
| Display name DB write fails | Inline `"Не вдалося зберегти ім'я, спробуй ще раз."`, field keeps the user's typed value (not reverted) |
| Password fields don't match (client-side) | Inline `"Паролі не співпадають"`, no server call |
| Password shorter than 6 chars (client-side) | Inline `"Пароль має містити щонайменше 6 символів."`, no server call |
| `updatePassword` server call fails (e.g. Supabase rejects the password) | Inline error from `mapAuthError`, fields keep their typed values so the user doesn't have to retype |
| User not logged in and somehow lands on `/settings` | Redirected to `/login`, same as every other `(app)` route (unchanged) |

## Testing

No test runner in this repo (established convention) — manual
verification via the live preview:

1. Open `/settings` → see three cards in order: Обліковий запис, Пароль,
   Telegram.
2. Account card shows the logged-in user's real email as static text.
3. Type a name into "Як до тебе звертатись?", click Зберегти → see
   "Збережено" confirmation → reload the page → name persists.
4. Clear the name field and save → reload → field is empty again (stored
   as `null`, not an empty string).
5. Password card: enter mismatched passwords → inline "Паролі не
   співпадають", no request sent (check via network tab).
6. Enter matching passwords <6 chars → inline length error, no request
   sent.
7. Enter matching valid passwords → "Пароль оновлено" → sign out → sign
   back in with the *new* password → succeeds.
8. Telegram card still works exactly as before (connect/disconnect
   unaffected by its new position on the page).

## Self-authored decisions (assumptions — user may veto at spec review)

- Empty display name saves as `null` rather than `""` — keeps "not set"
  unambiguous if this field is ever surfaced elsewhere later.
- Save confirmations ("Збережено" / "Пароль оновлено") auto-fade after
  ~2s rather than persisting — mirrors the existing copy-checkmark timeout
  in `telegram-connect-card.tsx`, so feedback timing feels consistent
  across the page.
- Password change does not sign the user out of their current session or
  other devices/sessions — Supabase's `updateUser` doesn't do this
  automatically, and forcing a re-login wasn't requested.
- No explicit heading/subtitle added below the page's existing
  "Налаштування" `<h2>` — the three card headings (Обліковий запис,
  Пароль, Telegram) already make the page self-explanatory without extra
  copy.
