# coralQ landing page — design spec

## Context

coralQ has no public-facing page today: `/` unconditionally redirects to
`/today`, and middleware force-redirects any unauthenticated request (except
`/login`) to `/login`. This spec adds a real marketing landing page at `/`
for logged-out visitors, built for a Skelar AI Lab test-task submission —
so it needs to both **wow** as a product demo and read as a competent piece
of engineering to a technical reviewer, without mixing those two goals on
the same screen.

Source of truth for the app's existing visual language: the coralQ ocean
palette, Fraunces/Nunito Sans type, and component patterns already shipped
in `src/components/gentle/` and documented in
`docs/superpowers/specs/2026-07-21-coralq-redesign-design.md`. This spec
reuses that system rather than inventing a new one.

## Decisions locked with the user

- **Purpose:** Ukrainian-language landing that demonstrates the product to
  a test-task reviewer. The hero screen is pure "wow" — no feature copy, no
  instructions, no technical talk. Instructions and technical details exist
  further down the page, never on the first screen.
- **All four candidate features** (Focus, Aquarium, gentle/no-guilt
  philosophy, Telegram AI capture) are demonstrated, framed as expressions
  of one gentle philosophy rather than a flat feature-bullet list.
- **Wow level: full interactive demo.** Real animated pieces, not
  screenshots — reusing actual app components/animation techniques where
  possible.
- **Placement:** replaces `/` for logged-out visitors. Logged-in users keep
  landing on `/today` exactly as today.
- **Hero concept: "Living Ocean"** (chosen over a static product-mockup
  hero and a full scroll-jacking "scrollytelling" hero) — the hero itself
  *is* an animated aquarium/ocean scene, reusing the swim/bubble animation
  techniques already proven in `aquarium-tank.tsx`. Chosen for the best
  wow-to-effort ratio and because it's literally built from the app's most
  distinctive feature rather than a generic SaaS composition.
- **Technical-details section: "stack strip + highlights"** — compact, not
  a full architecture writeup.
- **Instructions section: visual step-by-step cards** (3–4 steps), not
  prose.
- **Fast login/signup access** (raised mid-review): a persistent header
  must make "Увійти" / "Спробувати" reachable from anywhere on the page,
  not just the hero — see "Header" below.

## Routing & architecture

- **`src/middleware.ts`**: currently treats only `/login` as a public
  route (`isAuthRoute`). Add `/` to the public set so a logged-out visitor
  hitting `/` is not bounced to `/login`:
  ```
  const isAuthRoute = pathname.startsWith("/login");
  const isPublicRoute = pathname === "/" || isAuthRoute;
  if (!user && !isPublicRoute) → redirect to /login   // unchanged for all other routes
  if (user && isAuthRoute)     → redirect to /          // unchanged
  ```
  No change needed for the logged-in-at-`/` case — `page.tsx` already
  handles that (see below).
- **`src/app/page.tsx`**: becomes an async server component using the
  existing `createClient` helper from `@/lib/supabase/server` (same
  pattern as `(app)/layout.tsx`). Logged-in → `redirect("/today")`
  (unchanged behavior). Logged-out → renders `<LandingPage />`.
- New components live in **`src/components/landing/`**, parallel to
  `src/components/gentle/`. Landing sections are full-width/responsive —
  **not** constrained to the app shell's `max-w-md` phone-width frame;
  this is a marketing page viewed on desktop and mobile alike.
- **AGENTS.md note:** this repo's Next.js is a non-standard version with
  its own breaking changes from the trained-on APIs (see
  `node_modules/next/dist/docs/`). Anything touching routing conventions,
  `useSearchParams`, or streaming/Suspense behavior (see `AuthForm` change
  below) must be checked against those local docs before implementation,
  not assumed from training data.

## Component architecture

```
src/components/landing/
  landing-page.tsx          — composes all sections in order
  landing-header.tsx         — sticky header, scroll-aware style, "use client"
  landing-ocean-scene.tsx    — decorative animated hero background (fish, bubbles, rays, shoreline)
  landing-hero.tsx           — wordmark + tagline + CTA layered over the ocean scene
  landing-philosophy.tsx     — manifesto bridge section
  landing-focus-demo.tsx     — interactive Focus mini-demo (time picker → suggested task → session preview)
  landing-aquarium-demo.tsx  — thin wrapper: real AquariumTank + framing copy
  landing-telegram-demo.tsx  — looping chat-bubble animation (voice note → parsed task)
  landing-steps.tsx          — "how it works" step cards
  landing-tech.tsx           — stack badges + technical highlights
  landing-footer-cta.tsx     — repeat CTA + footer
  scroll-reveal.tsx          — shared IntersectionObserver fade/rise-in wrapper, used by sections 2–7
```

**Reuse vs. new:**
- `AquariumTank` (`src/components/gentle/aquarium-tank.tsx`) is reused
  **as-is** — it's already prop-driven (`eggs`, `unlocked`, `swimmerCount`)
  with no auth/data coupling, and its own `useOceanNoise()` dependency is
  fully self-contained client-side Web Audio (verified in
  `src/lib/ocean-noise.ts` — no network/auth calls).
- `CelebrationModal` (`src/components/gentle/celebration-modal.tsx`) is
  reused **as-is** for the Focus demo's payoff moment — its props
  (`kind`, `taskTitle`, `onClose`) have no server dependency.
- `FocusCard` and `FocusSessionModal` are **not** reused directly — both
  call real Server Actions (`finishFocusSession`, resource-status context,
  Supabase-backed task lists) that don't exist for an anonymous visitor.
  `landing-focus-demo.tsx` is a new component that visually matches them
  (same ring-timer styling, same copy voice) but runs entirely on local
  state and a small hardcoded sample-task list.
- `Wordmark` is reused as-is in the header and hero.

## Sections, in scroll order

1. **Hero — `landing-ocean-scene.tsx` + `landing-hero.tsx`.**
   Full-viewport gradient (`--sea-deep` → `--sea` → pale) with drifting
   fish silhouettes (reusing the fish-path/swim-keyframe technique from
   `aquarium-tank.tsx`, extended with a couple more lanes for a fuller
   scene), rising bubbles, a soft diagonal light-ray overlay, and a sandy
   shoreline silhouette at the bottom edge. Centered on top: `Wordmark`
   (white), one-line tagline, single primary CTA. No secondary content,
   no scroll hints beyond the natural cue of the next section peeking in.
   - Tagline: *"Продуктивність без тиску — росте разом із тобою."*
   - CTA: *"Спробувати →"* → links to `/login?mode=signup`.

2. **Philosophy bridge — `landing-philosophy.tsx`.**
   Two sentences, centered, generous whitespace, `scroll-reveal`d in.
   Frames sections 3–5 as one idea rather than a feature list:
   > *«coralQ не карає за пропущений день і не веде рахунок провалам. Ти
   > обираєш, скільки маєш сил зараз, — застосунок підбирає задачу під це,
   > а не навпаки.»*

3. **Focus зараз — `landing-focus-demo.tsx`.**
   Heading *"Фокус зараз"*, sub *"Скажи, скільки в тебе часу й сил —
   отримаєш одну задачу, а не весь список."* Visually matches the real
   `FocusCard` (gradient `sea`→`sea-deep` panel, same time-chip row).
   Behavior: clicking a time chip (15/30/45 хв/Понад годину) filters a
   hardcoded sample-task list by duration and shows one matched task
   (same priority/urgency sort as the real card, minus the energy-toggle
   dependency — energy is fixed at a friendly default for the demo).
   Clicking *"Почати фокус"* opens a session preview: the same ring-timer
   visual as `FocusSessionModal`, but running a compressed demo clock
   (a few seconds, not real duration) that always completes, closing into
   `CelebrationModal`'s fish moment — a taste of the full Focus → Aquarium
   loop without needing an account. Energy is fixed at level 2 ("В нормі")
   for the demo — see assumption 3 below.
   Sample tasks (drafted, adjustable at implementation):
   - «Відповісти на лист від клієнта» — 15 хв, енергія 1, звичайне
   - «Прибрати на столі» — 15 хв, енергія 1, колись
   - «Скласти план на тиждень» — 30 хв, енергія 2, важливо
   - «Розібрати пошту» — 20 хв, енергія 2, звичайне
   - «Підготувати презентацію» — 45 хв, енергія 3, важливо

4. **Акваріум — `landing-aquarium-demo.tsx`.**
   Heading *"Твій акваріум"*, sub *"Кожна завершена задача — нова рибка.
   Жодних вигорілих стріків, тільки риф, який росте."* Renders the real
   `AquariumTank` with `eggs={1}`, `unlocked={SPECIES.slice(0, 5)}`,
   `swimmerCount={5}` — genuinely swimming fish, genuine bubbles, the same
   play/pause ocean-noise button as the real app.

5. **Telegram AI capture — `landing-telegram-demo.tsx`.**
   Heading *"Скинь думку в Telegram"*, sub *"Голосове чи текстове
   повідомлення саме стає задачею — з часом, енергією і пріоритетом."* A
   self-contained looping 3-beat animation inside a phone/chat-bubble
   frame: (1) a voice-note bubble with a waveform icon appears, (2) a
   brief "typing/parsing" indicator, (3) it resolves into a mini task-card
   with parsed fields highlighted (time/energy/priority pills), holds,
   then resets. Runs on an interval; also replayable via a small
   *"▶ Показати ще раз"* control for anyone who lands mid-cycle.

6. **How it works — `landing-steps.tsx`.**
   Heading *"Як це працює"*, 4 numbered cards:
   1. Постав рівень енергії — Мало сил / В нормі / Повний заряд.
   2. Отримай пропозицію у Фокусі — або накидай задачі голосом у Telegram.
   3. Заверши без тиску — вийти можна будь-коли, це теж рахується.
   4. Дивись, як росте твій акваріум.

7. **Under the hood — `landing-tech.tsx`.**
   Heading *"Під капотом"*. A row of stack badges (Next.js 16 · React 19 ·
   Supabase · Tailwind CSS v4 · grammY / Telegram Bot API · TypeScript +
   Zod) plus 3–4 short highlight lines, only claims already verified in
   this codebase:
   - Фокус підбирає задачу локальною сортувальною логікою (дедлайн →
     пріоритет → час) без зайвих запитів до бази.
   - Звук моря у фокус-сесії синтезується в браузері через Web Audio API
     — жодного аудіофайлу.
   - Голосові та текстові повідомлення з Telegram парсяться в структуровані
     задачі через бота на grammY.
   - Уся анімація на цій сторінці — inline SVG та CSS плюс
     `IntersectionObserver`, без сторонніх бібліотек для графіки.

8. **Final CTA + footer — `landing-footer-cta.tsx`.**
   Repeat wordmark + CTA (*"Спробувати coralQ →"*), small footer line
   (*"Зроблено з 🪸"*) with a "Дивитись код на GitHub" link to
   `github.com/annaederpro/skelar`.

## Header (persistent, fast access to login/signup)

`landing-header.tsx` is sticky for the *entire* page, not just the hero:
small `Wordmark` on the left, *"Увійти"* text link + *"Спробувати"* pill
button on the right. Transparent with white text while the hero is in
view; crossfades to a solid `paper` background with dark text once
scrolled past it (`IntersectionObserver` on the hero, same primitive used
for scroll-reveal rather than a scroll-position listener). This guarantees
login/signup is at most one click away regardless of scroll position, on
top of the repeated CTAs in the hero and footer.

## Motion & accessibility

- `scroll-reveal.tsx` wraps sections 2–7 with a fade + slight rise-in on
  intersection, implemented with native `IntersectionObserver` — no new
  dependency.
- Every decorative animation (fish drift, bubbles, light rays,
  scroll-reveal, header crossfade, Telegram loop) is disabled under
  `@media (prefers-reduced-motion: reduce)`, collapsing to a static final
  state — consistent with the app's own gentle, no-pressure ethos.
- No new npm dependencies for animation; everything is inline SVG/CSS in
  the existing `<style>`-tag pattern already used by `aquarium-tank.tsx`
  (`TANK_CSS`) and `globals.css` (`release-bubble`/`release-glow`).

## Copy & tone

Ukrainian throughout, matching the app's existing warm/gentle voice
("без поспіху," "Пишаюся тобою"-style warmth) — draft copy above follows
that voice; wording may be refined during implementation but the tone
should not drift toward generic corporate SaaS phrasing.

## Self-authored decisions (assumptions — user may veto at spec review)

1. **`AuthForm` gains optional `?mode=signup` support** (read via
   `useSearchParams`, defaulting to today's sign-in view when absent) so
   the landing's primary CTA can deep-link straight into signup instead of
   costing an extra click. Small, additive, doesn't change existing
   `/login` behavior when the param is absent. Must be checked against
   this repo's local Next.js docs for correct Suspense/streaming handling
   before implementation (see AGENTS.md note above).
2. **Footer includes a public GitHub link** to
   `github.com/annaederpro/skelar`. Repo visibility (public/private)
   wasn't verified — drop this link at spec review if the repo should stay
   private.
3. **Focus demo's energy dimension is fixed at level 2 ("В нормі")**
   (rather than exposing a mood selector) since the real energy toggle is
   part of the authenticated app shell, not the landing — keeps the demo
   to one interaction (time) instead of two.
4. **Sample task list and exact copy wording** (hero tagline, philosophy
   text, section subheads) are drafted above but are placeholder-quality
   prose, not final marketing copy — refinable without changing structure.

## Out of scope

- Any change to authenticated app screens (`/today`, `/inbox`,
  `/upcoming`, `/browse`, `/aquarium`, `/settings`) — purely additive.
- Real backend wiring for any landing demo — Focus/Aquarium/Telegram demos
  all run on local/sample state, never a visitor's real data.
- English or bilingual version — Ukrainian only.
- CMS or externalized copy — hardcoded in components, same as the rest of
  the app.
- Analytics/tracking integration.
- Changes to `/login` page layout or `layout.tsx` metadata beyond the
  optional `AuthForm` query-param support above.

## Verification approach

`npx tsc --noEmit` + `npm run lint` clean, then live verification via the
preview tools: hero animation renders and loops, scroll-reveal fires for
each section, Focus demo's time-chip → suggested-task → session-preview →
celebration flow works end to end, Aquarium demo renders real swimming
fish, Telegram loop animates, header crossfades correctly at the hero
boundary and stays sticky, `?mode=signup` deep-link opens `AuthForm` in
signup view, `prefers-reduced-motion` emulation collapses all motion to a
static state, responsive check at mobile and desktop widths, and
confirming the routing split: `/` serves the landing when logged out and
still redirects to `/today` when logged in, with `/login` unaffected.
