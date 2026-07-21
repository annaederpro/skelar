# Aquarium creature icon upgrade (Twemoji) — design spec

## Context

The aquarium's 12 species icons in `src/lib/aquarium-species.tsx` are
minimal hand-drawn SVG blobs. The user wants higher-quality creature art
sourced from free libraries, with more variety. Approved direction (see
session artifact "Акваріум: оновлення риб"): use **Twemoji**
(jdecked/twemoji fork, graphics licensed **CC-BY 4.0**) silhouettes,
recolored into the coralQ palette, and grow the roster from 12 to 16
species.

Sources considered and rejected:
- **Flaticon** — SVG downloads premium-gated, per-author attribution,
  proprietary license, not fetchable programmatically.
- **OpenMoji** — CC-BY-SA share-alike clause is unsuitable for a
  proprietary app.
- **Noto Emoji** — permissive (Apache 2.0) but its shaded style clashes
  with coralQ's flat look.

## What changes

### 1. `src/lib/aquarium-species.tsx` — rewritten icons + 4 new species

**8 existing species get Twemoji-based icons** (paths taken from the
Twemoji SVG assets, simplified — micro-details dropped — and every fill
remapped to the creature's existing coralQ palette colors, so each reads
as "same fish, better linework"):

| Species | Twemoji source | Palette family kept |
|---|---|---|
| Клоун | fish (1f41f) + added white stripe | coral |
| Хірург | tropical fish (1f420) | sea + sand accents |
| Медуза | jellyfish (1fabc), face dropped | anemone |
| Риба-їжак | blowfish (1f421), simplified | sand |
| Краб | crab (1f980), body + claws only | coral |
| Черепаха | turtle (1f422) | sea |
| Дельфін | dolphin (1f42c) | sea |
| Кит | whale (1f433) | sea |

**4 new species** from the same set: Кальмар (squid 1f991, coral tones),
Восьминіг (octopus 1f419, anemone tones), Корал (coral 1fab8, coral
tones — on-brand), Акула (shark 1f988, pale-sea tones).

**4 species stay hand-drawn** (no emoji equivalent exists in Unicode):
Морський коник, Зірка, Актинія, Скат. Unchanged this pass.

**Thresholds: existing values must not move** (never re-lock an already
unlocked species). Newcomers interleave between existing values:

```
1 Клоун · 6 Морський коник · 12 Зірка · 20 Хірург · 30 Медуза ·
42 Черепаха · 48 Кальмар (new) · 56 Краб · 64 Восьминіг (new) ·
72 Риба-їжак · 80 Корал (new) · 90 Актинія · 110 Скат ·
120 Акула (new) · 132 Дельфін · 156 Кит
```

**Contract unchanged:** `SPECIES` stays a threshold-sorted array of
`{ name, threshold, icon }` where `icon` is JSX sharing the 38×30
viewBox. Both consumers (`aquarium/page.tsx` grid, `aquarium-tank.tsx`
swimmers) keep working without signature changes. Twemoji's 36×36 art is
fitted via a wrapping `<g transform="translate(…) scale(…)">` per icon.

Recoloring uses only palette hexes already present in the file, plus
three derived shades for value contrast the palette lacks:
deep-anemone `#9E77AC` (octopus legs), deep-coral `#C96F52` (reserved),
pale-sea from existing `#9FC7C9` (shark). A file-top comment documents
the Twemoji provenance and license.

### 2. `src/app/(app)/aquarium/page.tsx` — attribution line

CC-BY 4.0 requires credit. Add one muted footer line under the
collection grid: `Іконки: Twemoji · CC-BY 4.0`, linking "Twemoji" to
`https://github.com/jdecked/twemoji`. Nothing else on the page changes —
the 4-column grid renders 16 species as an exact 4×4, and the
"next species" hint logic already works off the sorted array.

## Error handling

None new — the change is static JSX data. Locked-cell placeholder
silhouette and pluralization helpers are untouched.

## Verification

`npx tsc --noEmit` + `npm run lint` clean; then live browser check of
/aquarium (tank swimmers, 4×4 collection grid, locked/unlocked states,
credit line) against the running dev server.

## Out of scope

- Upgrading the 4 hand-drawn species' fidelity (possible later via a CC0
  set, e.g. SVG Repo / Kenney).
- Persisted unlock records, per-species animations, celebration-modal
  art (it does not use SPECIES).
