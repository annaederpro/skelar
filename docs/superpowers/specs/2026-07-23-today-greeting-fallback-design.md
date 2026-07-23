# Today greeting fallback — design

## Problem

The Today/Focus header shows a greeting line (`Привіт, {displayName}! Як ти?`) above the resource-status toggle, but only when the signed-in user's profile has a `display_name` set. When it's empty (as for the current test account), the line is skipped entirely, leaving a blank gap above the toggle buttons — visible in the reported screenshot.

## Change

In `AppHeader` ([src/components/gentle/app-shell.tsx](../../../src/components/gentle/app-shell.tsx)), the greeting condition changes from:

```tsx
{showFocus && displayName && (
  <p className="text-[14px] font-bold text-ink">Привіт, {displayName}! Як ти?</p>
)}
```

to always rendering when `showFocus` is true, with the text depending on whether `displayName` is present:

- `displayName` present → `Привіт, {displayName}! Як ти?` (unchanged)
- `displayName` absent → `Привіт! Як ти?`

## Scope

- Only touches this one conditional/paragraph in `AppHeader`.
- Only affects the Сьогодні/Focus tab (`showFocus`), matching current behavior — not extended to other tabs.
- No new state, no API/data changes, no other components touched.
