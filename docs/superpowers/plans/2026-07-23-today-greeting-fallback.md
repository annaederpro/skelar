# Today Greeting Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Always show the Today/Focus header greeting, falling back to a name-less string when the user has no `display_name`.

**Architecture:** Single conditional change in `AppHeader` inside `src/components/gentle/app-shell.tsx` — no new components, state, or data flow.

**Tech Stack:** Next.js (App Router), React, TypeScript.

## Global Constraints

- Only the Сьогодні/Focus tab (`showFocus`) is affected — no other tabs.
- Greeting copy: `Привіт, {displayName}! Як ти?` when `displayName` is truthy, `Привіт! Як ти?` otherwise.

---

### Task 1: Render greeting fallback when displayName is missing

**Files:**
- Modify: `src/components/gentle/app-shell.tsx:56-58`

**Interfaces:**
- Consumes: existing `displayName: string | null` prop and `showFocus: boolean` local in `AppHeader`.
- Produces: n/a (leaf UI change, nothing downstream depends on it).

- [ ] **Step 1: Update the greeting JSX**

Replace:

```tsx
        {showFocus && displayName && (
          <p className="text-[14px] font-bold text-ink">Привіт, {displayName}! Як ти?</p>
        )}
```

with:

```tsx
        {showFocus && (
          <p className="text-[14px] font-bold text-ink">
            {displayName ? `Привіт, ${displayName}! Як ти?` : "Привіт! Як ти?"}
          </p>
        )}
```

- [ ] **Step 2: Verify in the browser**

Start the dev server (or reuse the running one), open `/today` for an account with no `display_name` set, and confirm the header now shows "Привіт! Як ти?" above the resource-status toggle instead of a blank gap. Also check an account that does have a `display_name` still shows the personalized greeting.

- [ ] **Step 3: Commit**

```bash
git add src/components/gentle/app-shell.tsx
git commit --no-gpg-sign -m "fix: show fallback greeting on Today header when no display name is set"
```
