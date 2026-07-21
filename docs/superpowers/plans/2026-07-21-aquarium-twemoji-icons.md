# Aquarium Twemoji Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 8 hand-drawn aquarium species icons with recolored Twemoji artwork and add 4 new species (squid, octopus, coral, shark), growing the roster from 12 to 16, plus the required CC-BY credit line.

**Architecture:** `SPECIES` in `src/lib/aquarium-species.tsx` stays a threshold-sorted array of `{ name, threshold, icon }` with icons sharing the 38×30 viewBox — both consumers (`aquarium/page.tsx` grid, `aquarium-tank.tsx` swimmers) need no changes. Twemoji 36×36 paths are fitted with a wrapping `<g transform>`, fills remapped to coralQ palette hexes.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Tailwind 4. No test framework in this repo — verification is `npx tsc --noEmit`, `npm run lint`, and live browser check (project convention).

## Global Constraints

- Existing unlock thresholds must not move (never re-lock an unlocked species). Final threshold sequence: 1, 6, 12, 20, 30, 42, **48**, 56, **64**, 72, **80**, 90, 110, **120**, 132, 156 (bold = new species).
- Icons use only coralQ palette hexes already in the file, plus derived `#9E77AC` (deep anemone). All JSX (camelCase SVG attrs: `strokeWidth`, `strokeLinecap`).
- 4 species stay hand-drawn verbatim: Морський коник, Зірка, Актинія, Скат.
- Git commits: `--no-gpg-sign` (project requirement).

---

### Task 1: Rewrite `src/lib/aquarium-species.tsx`

**Files:**
- Modify: `src/lib/aquarium-species.tsx` (full rewrite)

**Interfaces:**
- Produces: `SPECIES: { name: string; threshold: number; icon: React.ReactNode }[]` — same export name and shape as today; 16 entries sorted ascending by threshold; every `icon` valid inside `<svg viewBox="0 0 38 30">`.

- [ ] **Step 1: Replace the file contents entirely** with the code below (Twemoji-derived icons per the spec's mapping table; the 4 keepers copied unchanged from the current file):

The complete new file is long; its authoritative content is produced during execution from the approved artifact "Акваріум: оновлення риб" (`fish-design-proposal.html` in the session scratchpad), which contains every path already recolored and transform-fitted. Conversion rules (mechanical, no judgment calls):
1. Take each species' SVG string from the artifact's `proposed` / `newcomers` / `current`(for the 4 keepers) maps.
2. Convert to JSX: `stroke-width`→`strokeWidth`, `stroke-linecap`→`strokeLinecap`; interpolate the artifact's `P.*` color constants to literal hexes (`P.sea`=#3E8E9C, `P.seaDeep`=#2E6E7A, `P.seaMid`=#5CB0AE, `P.seaMid2`=#4FA0A0, `P.seaLight`=#5FB0AE, `P.seaPale`=#8FC6CD, `P.seaPale2`=#9FC7C9, `P.coral`=#DF8464, `P.coralMid`=#E7936F, `P.coralPale`=#F3B39A, `P.sand`=#EBD98A, `P.sandDeep`=#D9C46A, `P.anem`=#B98AC0, `P.anemMid`=#C58BB0, `P.anemPale`=#C9A0CF, `P.anemDeep`=#9E77AC, `P.ink`=#33403E, `P.inkDeep`=#1E4E56).
3. Assemble entries in threshold order: Клоун 1 (clown), Морський коник 6 (keeper), Зірка 12 (keeper), Хірург 20 (surgeon), Медуза 30 (jelly), Черепаха 42 (turtle), Кальмар 48 (squid), Краб 56 (crab), Восьминіг 64 (octopus), Риба-їжак 72 (puffer), Корал 80 (coralSp), Актинія 90 (keeper), Скат 110 (keeper), Акула 120 (shark), Дельфін 132 (dolphin), Кит 156 (whale).
4. File-top comment must state: icons partly derived from Twemoji (jdecked/twemoji), CC-BY 4.0, recolored to the coralQ palette; 38×30 shared viewBox contract.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit clean (no output / no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/aquarium-species.tsx
git commit --no-gpg-sign -m "feat: Twemoji-based aquarium icons + 4 new species (squid, octopus, coral, shark)"
```

### Task 2: Attribution line + live verification

**Files:**
- Modify: `src/app/(app)/aquarium/page.tsx` (add one footer line after the next-species hint block, inside the collection `<div>`)

**Interfaces:**
- Consumes: nothing new — page already imports `SPECIES`; 16 entries render as an exact 4×4 in the existing `grid-cols-4`.

- [ ] **Step 1: Add the credit line** — immediately after the `nextSpecies ? (...) : (...)` conditional block's closing, still inside the collection wrapper `<div>`:

```tsx
        <p className="mt-3 text-center text-[10.5px] text-ink-soft">
          Іконки частково —{" "}
          <a
            href="https://github.com/jdecked/twemoji"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Twemoji
          </a>{" "}
          · CC-BY 4.0
        </p>
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Live browser verification**

Start this session's own dev server (another session's server may hold :3000; Next picks the next port automatically). Verify on /aquarium (auth via existing session or credentials from `.env.local` if present):
- tank renders swimmers with new icons; play button still animates them;
- collection grid is 4×4 with 16 named cells, locked cells show the generic silhouette + lock;
- credit line renders under the hint card;
- no console errors.
If auth credentials are unavailable, verify the icon JSX renders by temporarily previewing the login-free route fallback is NOT acceptable — instead report the limitation and verify via the artifact-rendered shapes + type-check only, flagging the gap.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/aquarium/page.tsx
git commit --no-gpg-sign -m "feat: Twemoji CC-BY credit line on aquarium collection"
```

## Self-Review

- Spec coverage: Task 1 covers the icon rewrite + roster + thresholds + provenance comment; Task 2 covers attribution + verification. Out-of-scope items untouched. ✓
- Placeholder scan: Task 1 Step 1 delegates exact code to the approved artifact (deterministic conversion rules given) rather than duplicating ~300 lines — the source content exists and is user-approved, not TBD. ✓
- Type consistency: `SPECIES` export shape unchanged; consumers untouched. ✓
