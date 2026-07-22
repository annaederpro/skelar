# coralQ Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public Ukrainian marketing landing page for coralQ at `/` — a "Living Ocean" hero plus interactive Focus/Aquarium/Telegram demos framed as one gentle philosophy — for a Skelar AI Lab test-task submission.

**Architecture:** `/` becomes auth-aware: middleware stops force-redirecting it to `/login`, and the root `page.tsx` server-renders the new `LandingPage` for logged-out visitors while still redirecting logged-in users to `/today` exactly as today. `LandingPage` composes nine new components under `src/components/landing/` in scroll order (sticky header, hero, philosophy, three feature demos, steps, tech, footer), reusing real app components (`AquariumTank`, `CelebrationModal`, `Wordmark`) wherever they have no auth/data coupling, and building small self-contained demos where they do.

**Tech Stack:** Next.js 16 (App Router, Server Components) / React 19 / TypeScript / Tailwind CSS v4 / Supabase (`@supabase/ssr`) / lucide-react. No test framework in this repo — verification is `npx tsc --noEmit`, `npm run lint`, and live browser checks (project convention).

## Global Constraints

- Ukrainian copy only, matching the app's existing warm/gentle tone (no hard-red alerts, no guilt language) — full spec at `docs/superpowers/specs/2026-07-22-coralq-landing-design.md`.
- No new npm dependencies. Build entirely from what's already installed: `lucide-react` for icons, native `IntersectionObserver` / `matchMedia` / `requestAnimationFrame`, inline `<style>` blocks for keyframes — matching `src/components/gentle/aquarium-tank.tsx`'s established pattern exactly (hand-written CSS gradients/keyframes in a template-literal `<style>` tag, not Tailwind gradient utilities, not a CSS-in-JS library).
- Landing components (`src/components/landing/**`) are full-width/responsive — never constrained to the app shell's `max-w-md` phone-width frame.
- Every animated element collapses to a static state under `@media (prefers-reduced-motion: reduce)` or a `prefers-reduced-motion` JS check.
- Git commits always use `--no-gpg-sign` (project requirement — pinentry is unavailable in this environment).
- Verification convention (no automated test framework exists in this repo): `npx tsc --noEmit` + `npm run lint` clean after every task, plus a live browser check via the preview tools.
- This repo's Next.js/Tailwind/lucide-react versions have non-standard APIs relative to training data (see root `AGENTS.md`). Facts used below (gradient syntax, `useSearchParams` + Suspense behavior, lucide icon names) were verified directly against this repo's code and `node_modules` rather than assumed — if a later task needs an API not already proven elsewhere in this codebase, verify it the same way before using it.

---

### Task 1: Make `/` a public route with a landing-page shell

**Files:**
- Modify: `src/lib/supabase/middleware.ts`
- Modify: `src/app/page.tsx`
- Create: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Produces: `LandingPage` — a zero-prop component exported from `src/components/landing/landing-page.tsx`, rendered by `src/app/page.tsx` for logged-out visitors. Every later task in this plan modifies this file's JSX body to add one more section; the exported name and zero-prop signature never change.

- [ ] **Step 1: Update middleware to treat `/` as public**

Replace the full contents of `src/lib/supabase/middleware.ts`:

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

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login");
  // "/" is public too — it now serves the marketing landing page to logged-out
  // visitors (src/app/page.tsx decides what to render/redirect from there).
  const isPublicRoute = pathname === "/" || isAuthRoute;

  if (!user && !isPublicRoute) {
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

- [ ] **Step 2: Make the root page auth-aware**

Replace the full contents of `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "@/components/landing/landing-page";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/today");
  }

  return <LandingPage />;
}
```

- [ ] **Step 3: Create the landing page shell**

Create `src/components/landing/landing-page.tsx`:

```tsx
export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <h1 className="font-heading text-2xl font-semibold text-ink">coralQ</h1>
      <p className="text-sm text-ink-soft">Лендінг у розробці.</p>
    </main>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both exit clean (no errors).

- [ ] **Step 5: Live browser verification**

Start the dev server and check:
- Logged out, visiting `/` renders the shell ("coralQ" + "Лендінг у розробці.") instead of redirecting to `/login`.
- `/login` still renders the real login form (unaffected).
- Visiting any other unauthenticated route (e.g. `/today`) still redirects to `/login`.
- If a logged-in test session is available (existing browser session or credentials from `.env.local`): visiting `/` redirects to `/today`. If no credentials are available, note this gap explicitly rather than skipping silently — it gets re-verified in Task 11's end-to-end pass.
- No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/middleware.ts src/app/page.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: make / a public route for the coralQ landing page"
```

---

### Task 2: Living Ocean hero

**Files:**
- Create: `src/lib/use-prefers-reduced-motion.ts`
- Create: `src/components/landing/landing-ocean-scene.tsx`
- Create: `src/components/landing/landing-hero.tsx`
- Modify: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks besides the `LandingPage` shell from Task 1.
- Produces: `usePrefersReducedMotion(): boolean` from `@/lib/use-prefers-reduced-motion` (reused by Tasks 8's Telegram demo and available to any later task). `LandingHero` renders a `<div id="hero-end" />` sentinel at the bottom of the hero viewport — Task 3's header observes this exact element id to know when the hero has scrolled out of view. Do not rename or remove `#hero-end` in later tasks.

- [ ] **Step 1: Add the shared reduced-motion hook**

Create `src/lib/use-prefers-reduced-motion.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const handleChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Build the animated ocean scene**

Create `src/components/landing/landing-ocean-scene.tsx`:

```tsx
"use client";

import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const OCEAN_CSS = `
.lo-scene{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#2E6E7A 0%,#3E8E9C 55%,#8FC6CD 100%)}
.lo-rays{position:absolute;inset:0;opacity:.4;pointer-events:none;
  background:linear-gradient(115deg,rgba(255,255,255,.3) 0 6%,transparent 12% 22%,rgba(255,255,255,.2) 24% 30%,transparent 34%)}
@keyframes lo-swim-r{from{left:-10%}to{left:110%}}
@keyframes lo-swim-l{from{left:110%}to{left:-10%}}
.lo-bob{animation:lo-bob 3.4s ease-in-out infinite}
@keyframes lo-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.lo-bubble{position:absolute;bottom:-24px;border-radius:50%;background:rgba(255,255,255,.4);animation:lo-bubble linear infinite}
@keyframes lo-bubble{0%{transform:translateY(0) scale(.6);opacity:0}12%{opacity:.6}100%{transform:translateY(-70vh) scale(1);opacity:0}}
`;

const FISH_LANES = [
  { top: "20%", restLeft: 15, dur: 26, delay: 0, dir: 1 as const, size: 30, fill: "#E7936F", opacity: 0.85 },
  { top: "58%", restLeft: 72, dur: 32, delay: 4, dir: -1 as const, size: 24, fill: "#B4E0DE", opacity: 0.7 },
  { top: "38%", restLeft: 40, dur: 22, delay: 9, dir: 1 as const, size: 18, fill: "#F3C89A", opacity: 0.5 },
  { top: "72%", restLeft: 25, dur: 30, delay: 2, dir: -1 as const, size: 34, fill: "#DF8464", opacity: 0.9 },
  { top: "14%", restLeft: 60, dur: 36, delay: 12, dir: 1 as const, size: 20, fill: "#9FC7C9", opacity: 0.45 },
];

function FishSilhouette({ size, fill }: { size: number; fill: string }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 38 30" aria-hidden>
      <path
        d="M0 6 C-16 6 -18 -6 -8 -8 C-2 -14 12 -12 12 -2 C20 -2 18 8 8 8Z"
        fill={fill}
        transform="translate(10,10)"
      />
    </svg>
  );
}

export function LandingOceanScene() {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="lo-scene">
      <style>{OCEAN_CSS}</style>
      <div className="lo-rays" />

      {FISH_LANES.map((lane, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: lane.top,
            opacity: lane.opacity,
            ...(reducedMotion
              ? { left: `${lane.restLeft}%` }
              : {
                  animation: `${lane.dir > 0 ? "lo-swim-r" : "lo-swim-l"} ${lane.dur}s linear ${lane.delay}s infinite`,
                }),
          }}
        >
          <div className={reducedMotion ? undefined : "lo-bob"}>
            <div style={lane.dir < 0 ? { transform: "scaleX(-1)" } : undefined}>
              <FishSilhouette size={lane.size} fill={lane.fill} />
            </div>
          </div>
        </div>
      ))}

      {!reducedMotion &&
        Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className="lo-bubble"
            style={{
              left: `${8 + ((i * 11) % 86)}%`,
              width: 6 + (i % 3) * 4,
              height: 6 + (i % 3) * 4,
              animationDuration: `${9 + (i % 5) * 2}s`,
              animationDelay: `${i * 0.9}s`,
            }}
          />
        ))}

      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0 90 Q360 40 720 76 T1440 64 V160 H0Z" fill="#E7D9BC" />
        <path d="M0 118 Q400 90 760 108 T1440 100 V160 H0Z" fill="#D8C7A2" opacity=".65" />
      </svg>
    </div>
  );
}
```

- [ ] **Step 3: Build the hero content layer**

Create `src/components/landing/landing-hero.tsx`:

```tsx
import Link from "next/link";
import { LandingOceanScene } from "@/components/landing/landing-ocean-scene";

function HeroWordmark() {
  return (
    <span className="flex items-center justify-center font-heading text-[42px] font-semibold tracking-tight sm:text-[54px]">
      coral
      <svg width="34" height="41" viewBox="0 0 100 120" fill="none" className="relative top-2" aria-hidden>
        <circle cx="46" cy="46" r="29" stroke="#3E8E9C" strokeWidth="13" />
        <g stroke="#E08363" strokeWidth="12" strokeLinecap="round">
          <path d="M60 60 L72 74" />
          <path d="M72 74 L85 70" />
          <path d="M72 74 L79 90" />
        </g>
        <circle cx="70" cy="24" r="5.5" fill="#8FC6CD" />
      </svg>
    </span>
  );
}

export function LandingHero() {
  return (
    <section className="relative flex min-h-dvh items-center justify-center overflow-hidden">
      <LandingOceanScene />
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center text-white">
        <HeroWordmark />
        <p className="max-w-xs text-[16px] leading-relaxed text-white/90 sm:max-w-sm sm:text-[18px]">
          Продуктивність без тиску — росте разом із тобою.
        </p>
        <Link
          href="/login?mode=signup"
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-extrabold text-sea-deep shadow-[0_10px_26px_rgba(0,0,0,.18)] transition-transform hover:-translate-y-0.5"
        >
          Спробувати →
        </Link>
      </div>
      <div id="hero-end" className="absolute bottom-0 left-0 right-0 h-px" aria-hidden />
    </section>
  );
}
```

- [ ] **Step 4: Wire the hero into the landing page**

Replace the full contents of `src/components/landing/landing-page.tsx`:

```tsx
import { LandingHero } from "@/components/landing/landing-hero";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHero />
    </main>
  );
}
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Live browser verification**

Visit `/` logged out:
- Full-viewport ocean gradient renders (deep teal at top fading to pale blue), sandy shoreline visible at the bottom edge.
- 5 fish silhouettes drift across at different speeds/heights and bob up and down; bubbles rise from the bottom.
- Wordmark, tagline, and "Спробувати →" button are centered and readable over the scene.
- Clicking "Спробувати →" navigates to `/login?mode=signup` (the query param is inert until Task 4 — landing on the sign-in form is expected for now).
- In `preview_resize`, emulate `prefers-reduced-motion: reduce` (or run `preview_eval` with `window.matchMedia` mocked / OS-level setting) and confirm fish stop moving and hold still at scattered positions, bubbles disappear.
- No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/use-prefers-reduced-motion.ts src/components/landing/landing-ocean-scene.tsx src/components/landing/landing-hero.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: add Living Ocean hero to the coralQ landing page"
```

---

### Task 3: Sticky header for fast login/signup access

**Files:**
- Create: `src/components/landing/landing-header.tsx`
- Modify: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Consumes: the `#hero-end` sentinel element id produced by `landing-hero.tsx` (Task 2).
- Produces: `LandingHeader` — zero-prop component, rendered once at the top of `LandingPage`.

- [ ] **Step 1: Build the header**

Create `src/components/landing/landing-header.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/gentle/wordmark";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("hero-end");
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setSolid(!entry.isIntersecting), {
      rootMargin: "-72px 0px 0px 0px",
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        solid ? "bg-paper/90 shadow-sm backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5",
          solid ? "text-ink" : "text-white",
        )}
      >
        <Wordmark />
        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className={cn(
              "text-[13.5px] font-bold transition-colors",
              solid ? "text-ink-soft hover:text-ink" : "text-white/85 hover:text-white",
            )}
          >
            Увійти
          </Link>
          <Link
            href="/login?mode=signup"
            className={cn(
              "rounded-full px-4 py-2 text-[13.5px] font-extrabold transition-colors",
              solid ? "bg-sea text-white hover:bg-sea-deep" : "bg-white text-sea-deep hover:bg-white/90",
            )}
          >
            Спробувати
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Wire the header into the landing page**

Replace the full contents of `src/components/landing/landing-page.tsx`:

```tsx
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
    </main>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Live browser verification**

Visit `/` logged out:
- Header is visible immediately, overlaid transparently on the ocean scene, wordmark + "Увійти"/"Спробувати" all readable in white against the dark hero background.
- Both header links are clickable at all times (no scroll needed) and point to `/login` and `/login?mode=signup` respectively.
- Since the hero is `min-h-dvh` (one full viewport), scroll down slightly past it (there's currently nothing below it yet — a few hundred px of `bg-paper` from the `<main>` background is enough) and confirm the header crossfades to a solid paper background with dark ink text, staying stuck to the top the whole time.
- Scroll back up — header returns to transparent/white over the hero.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/landing-header.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: add sticky header with fast login/signup access to the landing page"
```

---

### Task 4: Deep-link the CTA into signup mode

**Files:**
- Modify: `src/components/gentle/auth-form.tsx`
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: the `/login?mode=signup` links already produced by Tasks 2 and 3.
- Produces: nothing new consumed by later tasks — this closes out the CTA flow.

- [ ] **Step 1: Read the `mode` query param in `AuthForm`**

Replace the full contents of `src/components/gentle/auth-form.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, signUp, type AuthFormState } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = { error: null, message: null };

export function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
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

        {state.error && <p className="text-sm text-coral">{state.error}</p>}
        {state.message && <p className="text-sm text-sea-deep">{state.message}</p>}

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

(Only the top of the file changed: the `useSearchParams` import and the `mode` initializer. The rest is unchanged from today.)

- [ ] **Step 2: Wrap `AuthForm` in Suspense**

This repo's Next.js docs (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`) state that a static page calling `useSearchParams` from a Client Component **must** be wrapped in `<Suspense>` or the production build fails — dev mode won't show the problem. Replace the full contents of `src/app/login/page.tsx`:

```tsx
import { Suspense } from "react";
import { AuthForm } from "@/components/gentle/auth-form";
import { Wordmark } from "@/components/gentle/wordmark";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex flex-col items-center text-center">
        <Wordmark />
        <p className="mt-1 text-sm text-muted-foreground">Лагідний таск-менеджер</p>
      </div>
      <Suspense fallback={<div className="h-[268px]" />}>
        <AuthForm />
      </Suspense>
    </main>
  );
}
```

- [ ] **Step 3: Type-check, lint, and production build**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run: `npm run build`
Expected: build succeeds — this specifically catches the "Missing Suspense boundary with useSearchParams" failure mode called out in Step 2, which dev mode would hide.

- [ ] **Step 4: Live browser verification**

Start the dev server (`npm run build` doesn't serve the app, so verification still runs against `next dev`):
- Visit `/login` directly — form defaults to the sign-in view, unchanged from before.
- Visit `/login?mode=signup` directly — form opens already in the "Зареєструватися" (signup) view.
- From `/` (logged out), click the hero CTA and the header's "Спробувати" — both land on `/login?mode=signup` in signup view.
- Click the header's "Увійти" — lands on `/login` in sign-in view.
- The in-form toggle ("Немає акаунту? Зареєструватися" / "Вже є акаунт? Увійти") still switches modes normally.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/gentle/auth-form.tsx src/app/login/page.tsx
git commit --no-gpg-sign -m "feat: deep-link landing CTA into AuthForm's signup view"
```

---

### Task 5: Shared scroll-reveal + philosophy bridge section

**Files:**
- Create: `src/components/landing/scroll-reveal.tsx`
- Create: `src/components/landing/landing-philosophy.tsx`
- Modify: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Produces: `ScrollReveal` — `{ children: ReactNode; className?: string }`, exported from `@/components/landing/scroll-reveal`. Wraps its children in a fade/rise-in triggered once by `IntersectionObserver`, immediately visible (no animation) when `prefers-reduced-motion: reduce` is set. Reused by Tasks 6, 7, 8, 9, 10.

- [ ] **Step 1: Build the shared scroll-reveal wrapper**

Create `src/components/landing/scroll-reveal.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
}

export function ScrollReveal({ children, className }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Build the philosophy bridge section**

Create `src/components/landing/landing-philosophy.tsx`:

```tsx
import { ScrollReveal } from "@/components/landing/scroll-reveal";

export function LandingPhilosophy() {
  return (
    <section className="bg-sea px-6 py-20 text-white">
      <ScrollReveal className="mx-auto max-w-xl text-center">
        <p className="font-heading text-[22px] font-medium leading-snug sm:text-[26px]">
          coralQ не карає за пропущений день і не веде рахунок провалам.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-white/85 sm:text-[17px]">
          Ти обираєш, скільки маєш сил зараз, — застосунок підбирає задачу під це, а не навпаки.
        </p>
      </ScrollReveal>
    </section>
  );
}
```

- [ ] **Step 3: Wire the philosophy section into the landing page**

Replace the full contents of `src/components/landing/landing-page.tsx`:

```tsx
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
      <LandingPhilosophy />
    </main>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Live browser verification**

Visit `/` logged out and scroll past the hero:
- A solid-teal section appears with the two-sentence manifesto, centered, readable.
- It fades/rises into view as it enters the viewport (scroll down to trigger, refresh and check it's invisible-then-visible rather than always-visible).
- With `prefers-reduced-motion: reduce` emulated, the text is visible immediately on load with no animation.
- Header is solid (past the hero boundary) here.
- No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/landing/scroll-reveal.tsx src/components/landing/landing-philosophy.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: add philosophy bridge section to the coralQ landing page"
```

---

### Task 6: Interactive Focus demo

**Files:**
- Create: `src/components/landing/landing-focus-demo.tsx`
- Modify: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Consumes: `ScrollReveal` (Task 5); `CelebrationModal` from `@/components/gentle/celebration-modal` (props: `kind: CelebrationKind | null`, `taskTitle: string`, `onClose: () => void` — unchanged, existing component); `EFFORT_WORD`, `PRIORITY_BUCKET_LABEL`, `formatDuration`, `type EnergyLevel`, `type PriorityBucket` from `@/types/gentle` (existing exports).
- Produces: `LandingFocusDemo` — zero-prop component.

- [ ] **Step 1: Build the Focus demo**

Create `src/components/landing/landing-focus-demo.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Waves } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CelebrationModal } from "@/components/gentle/celebration-modal";
import { EFFORT_WORD, PRIORITY_BUCKET_LABEL, formatDuration, type EnergyLevel, type PriorityBucket } from "@/types/gentle";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { cn } from "@/lib/utils";

interface SampleTask {
  title: string;
  durationMinutes: number;
  energyLevel: EnergyLevel;
  priorityBucket: PriorityBucket;
}

// Fixed, self-contained sample data — never touches a visitor's real account.
const SAMPLE_TASKS: SampleTask[] = [
  { title: "Відповісти на лист від клієнта", durationMinutes: 15, energyLevel: 1, priorityBucket: "mid" },
  { title: "Прибрати на столі", durationMinutes: 15, energyLevel: 1, priorityBucket: "low" },
  { title: "Розібрати пошту", durationMinutes: 20, energyLevel: 2, priorityBucket: "mid" },
  { title: "Скласти план на тиждень", durationMinutes: 30, energyLevel: 2, priorityBucket: "high" },
  { title: "Підготувати презентацію", durationMinutes: 45, energyLevel: 3, priorityBucket: "high" },
];

// Demo energy is fixed at "В нормі" (spec assumption 3) — the real mood
// selector lives in the authenticated app shell, not the landing page.
const DEMO_ENERGY: EnergyLevel = 2;

const TIME_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "15 хв" },
  { minutes: 30, label: "30 хв" },
  { minutes: 45, label: "45 хв" },
  { minutes: 999, label: "Понад годину" },
];

const PRIORITY_WEIGHT: Record<PriorityBucket, number> = { high: 3, mid: 2, low: 1 };

const DEMO_SESSION_MS = 4800;
const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function LandingFocusDemo() {
  const [selectedMin, setSelectedMin] = useState<number | null>(null);
  const [poolIndex, setPoolIndex] = useState(0);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  const pool = useMemo(() => {
    if (selectedMin === null) return [];
    return SAMPLE_TASKS.filter(
      (t) => t.energyLevel <= DEMO_ENERGY && t.durationMinutes <= selectedMin,
    ).sort(
      (a, b) =>
        PRIORITY_WEIGHT[b.priorityBucket] - PRIORITY_WEIGHT[a.priorityBucket] ||
        a.durationMinutes - b.durationMinutes,
    );
  }, [selectedMin]);

  const suggested = pool.length > 0 ? pool[poolIndex % pool.length] : null;

  const handlePickTime = (minutes: number) => {
    setSelectedMin(minutes);
    setPoolIndex(0);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const startSession = () => {
    setSessionOpen(true);
    setProgress(0);
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const next = Math.min(elapsed / DEMO_SESSION_MS, 1);
      setProgress(next);
      if (next < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setSessionOpen(false);
        setCelebrating(true);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const closeSession = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setSessionOpen(false);
  };

  return (
    <section className="bg-paper px-6 py-20">
      <ScrollReveal className="mx-auto max-w-md">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Фокус зараз</h2>
        <p className="mt-2 text-center text-[14.5px] text-ink-soft">
          Скажи, скільки в тебе часу й сил — отримаєш одну задачу, а не весь список.
        </p>

        <div className="relative mt-6 overflow-hidden rounded-[24px] bg-gradient-to-br from-sea to-sea-deep p-[18px] text-white shadow-[0_10px_26px_rgba(46,110,122,.32)]">
          <div className="mb-0.5 flex items-center gap-2">
            <Waves className="size-5" aria-hidden />
            <span className="font-heading text-[18px] font-semibold">Спробуй прямо тут</span>
          </div>
          <p className="mb-3.5 text-[13px] leading-relaxed text-white/85">Скільки в тебе вільного часу?</p>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Скільки часу">
            {TIME_OPTIONS.map(({ minutes, label }) => (
              <button
                key={minutes}
                type="button"
                onClick={() => handlePickTime(minutes)}
                aria-pressed={selectedMin === minutes}
                className={cn(
                  "rounded-[14px] border-[1.5px] px-3.5 py-2 text-[13.5px] font-bold transition-colors",
                  selectedMin === minutes
                    ? "border-white bg-white text-sea-deep"
                    : "border-white/35 bg-white/10 text-white hover:bg-white/20",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {selectedMin !== null && (
            <div className="mt-3.5 rounded-[18px] bg-white/[.14] p-3.5">
              {suggested ? (
                <>
                  <p className="mb-1.5 text-xs text-white/85">✦ Підходить під твій час і сили</p>
                  <p className="text-[16px] font-bold leading-snug">{suggested.title}</p>
                  <p className="mt-1.5 flex items-center gap-3 text-[12.5px] text-white/85">
                    <span>🕐 {formatDuration(suggested.durationMinutes)}</span>
                    <span>{EFFORT_WORD[suggested.energyLevel]}</span>
                    <span>{PRIORITY_BUCKET_LABEL[suggested.priorityBucket]}</span>
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={startSession}
                      className="flex-1 rounded-[14px] bg-white py-2.5 text-sm font-extrabold text-sea-deep transition-transform hover:-translate-y-px"
                    >
                      Почати фокус
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoolIndex((i) => i + 1)}
                      className="rounded-[14px] bg-white/15 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/25"
                    >
                      Інша
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[14px] font-bold leading-snug">На цей час нічого важкого нема — теж результат.</p>
              )}
            </div>
          )}
        </div>
      </ScrollReveal>

      <Dialog open={sessionOpen} onOpenChange={(next) => !next && closeSession()}>
        <DialogContent className="text-center" showCloseButton={false}>
          {suggested && (
            <>
              <div className="text-xs font-extrabold uppercase tracking-widest text-sea">Фокус</div>
              <h3 className="mt-2 font-heading text-lg font-semibold leading-tight">{suggested.title}</h3>
              <div className="relative mx-auto my-4 size-[160px]">
                <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
                  <circle cx="80" cy="80" r={RADIUS} fill="none" stroke="#DDE8E4" strokeWidth="10" />
                  <circle
                    cx="80"
                    cy="80"
                    r={RADIUS}
                    fill="none"
                    stroke="#3E8E9C"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-heading text-2xl font-semibold">{Math.round(progress * 100)}%</span>
                </div>
              </div>
              <p className="mx-auto max-w-[240px] text-[13px] leading-relaxed text-ink-soft">
                Демо-сесія — у застосунку таймер триває стільки, скільки реально потрібно.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CelebrationModal
        kind={celebrating ? "fish" : null}
        taskTitle={suggested?.title ?? ""}
        onClose={() => {
          setCelebrating(false);
          setSelectedMin(null);
          setPoolIndex(0);
        }}
      />
    </section>
  );
}
```

- [ ] **Step 2: Wire the Focus demo into the landing page**

Replace the full contents of `src/components/landing/landing-page.tsx`:

```tsx
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";
import { LandingFocusDemo } from "@/components/landing/landing-focus-demo";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFocusDemo />
    </main>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Live browser verification**

Scroll to the Focus section on `/` (logged out):
- Clicking "15 хв" shows a matched sample task with duration/effort/priority meta.
- Clicking "Понад годину" still never surfaces "Підготувати презентацію" (energy 3 > the fixed demo energy of 2) — confirms the energy filter is real, not decorative.
- "Інша" cycles to a different matching task when more than one qualifies.
- Clicking "Почати фокус" opens the ring-timer dialog; the ring fills over roughly 5 seconds and the dialog auto-closes into the celebration modal (🐠 fish, correct task title in the copy).
- Closing the celebration modal resets the section back to its initial (no time picked) state.
- Opening a session and closing it early (backdrop click) closes silently — no celebration, ring resets on next open.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/landing-focus-demo.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: add interactive Focus demo to the coralQ landing page"
```

---

### Task 7: Live Aquarium demo

**Files:**
- Create: `src/components/landing/landing-aquarium-demo.tsx`
- Modify: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Consumes: `ScrollReveal` (Task 5); `AquariumTank` from `@/components/gentle/aquarium-tank` (props: `eggs: number`, `unlocked: typeof SPECIES`, `swimmerCount: number` — existing, unchanged, verified prop-driven with no auth coupling); `SPECIES` from `@/lib/aquarium-species` (existing).
- Produces: `LandingAquariumDemo` — zero-prop component.

- [ ] **Step 1: Build the Aquarium demo**

Create `src/components/landing/landing-aquarium-demo.tsx`:

```tsx
import { AquariumTank } from "@/components/gentle/aquarium-tank";
import { SPECIES } from "@/lib/aquarium-species";
import { ScrollReveal } from "@/components/landing/scroll-reveal";

export function LandingAquariumDemo() {
  return (
    <section className="bg-sea-soft px-6 py-20">
      <ScrollReveal className="mx-auto max-w-md">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Твій акваріум</h2>
        <p className="mt-2 text-center text-[14.5px] text-ink-soft">
          Кожна завершена задача — нова рибка. Жодних вигорілих стріків, тільки риф, який росте.
        </p>
        <div className="mt-6">
          <AquariumTank eggs={1} unlocked={SPECIES.slice(0, 5)} swimmerCount={5} />
        </div>
      </ScrollReveal>
    </section>
  );
}
```

- [ ] **Step 2: Wire the Aquarium demo into the landing page**

Replace the full contents of `src/components/landing/landing-page.tsx`:

```tsx
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";
import { LandingFocusDemo } from "@/components/landing/landing-focus-demo";
import { LandingAquariumDemo } from "@/components/landing/landing-aquarium-demo";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFocusDemo />
      <LandingAquariumDemo />
    </main>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Live browser verification**

Scroll to the Aquarium section on `/` (logged out):
- The tank renders with 5 swimming creatures and 1 egg on the sand, matching the real in-app aquarium visual style exactly (same component).
- The play/pause button in the tank's corner toggles swimming animation and bubbles, same as on the real `/aquarium` page.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/landing-aquarium-demo.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: add live Aquarium demo to the coralQ landing page"
```

---

### Task 8: Telegram AI capture demo

**Files:**
- Create: `src/components/landing/landing-telegram-demo.tsx`
- Modify: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Consumes: `ScrollReveal` (Task 5); `usePrefersReducedMotion` (Task 2).
- Produces: `LandingTelegramDemo` — zero-prop component.

- [ ] **Step 1: Build the Telegram demo**

Create `src/components/landing/landing-telegram-demo.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const STAGES = ["voice", "parsing", "task"] as const;
type Stage = (typeof STAGES)[number];
const STAGE_DURATION_MS = 2200;

export function LandingTelegramDemo() {
  const reducedMotion = usePrefersReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);
  const stage: Stage = STAGES[stageIndex];

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setStageIndex((i) => (i + 1) % STAGES.length), STAGE_DURATION_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <section className="bg-white px-6 py-20">
      <ScrollReveal className="mx-auto max-w-md">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Скинь думку в Telegram</h2>
        <p className="mt-2 text-center text-[14.5px] text-ink-soft">
          Голосове чи текстове повідомлення саме стає задачею — з часом, енергією і пріоритетом.
        </p>

        <div className="mt-6 rounded-[24px] border border-line bg-paper p-5">
          <div className="flex min-h-[132px] flex-col justify-end gap-2.5">
            {(stage === "voice" || stage === "parsing" || stage === "task") && (
              <div className="ml-auto flex max-w-[78%] items-center gap-2 rounded-[16px] rounded-br-sm bg-sea px-3.5 py-2.5 text-white">
                <Mic className="size-4 shrink-0" aria-hidden />
                <span className="flex items-end gap-[3px]" aria-hidden>
                  {[6, 12, 8, 16, 5].map((h, i) => (
                    <span key={i} className="w-[3px] rounded-full bg-white/80" style={{ height: h }} />
                  ))}
                </span>
                <span className="text-[12.5px] font-bold">0:07</span>
              </div>
            )}
            {(stage === "parsing" || stage === "task") && (
              <div className="mr-auto flex items-center gap-1.5 rounded-[16px] rounded-bl-sm bg-muted px-3.5 py-2.5 text-ink-soft">
                <Sparkles className="size-4" aria-hidden />
                <span className="text-[12.5px] font-bold">{stage === "parsing" ? "Розпізнаю…" : "Готово"}</span>
              </div>
            )}
            {stage === "task" && (
              <div className="mr-auto w-full max-w-[86%] rounded-[16px] rounded-bl-sm border border-line bg-card p-3.5 shadow-sm">
                <p className="text-[14px] font-semibold text-ink">Підготувати презентацію для клієнта</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-soft">
                  <span className="rounded-full bg-sea-soft px-2 py-0.5 font-bold text-sea-deep">🕐 45 хв</span>
                  <span className="rounded-full bg-anem-soft px-2 py-0.5 font-bold text-anem">глибока</span>
                  <span className="rounded-full bg-coral-soft px-2 py-0.5 font-bold text-coral">Важливо</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {reducedMotion && (
          <button
            type="button"
            onClick={() => setStageIndex((i) => (i + 1) % STAGES.length)}
            className="mx-auto mt-3 block rounded-full bg-muted px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft transition-colors hover:bg-muted/70"
          >
            ▶ Показати наступний крок
          </button>
        )}
      </ScrollReveal>
    </section>
  );
}
```

- [ ] **Step 2: Wire the Telegram demo into the landing page**

Replace the full contents of `src/components/landing/landing-page.tsx`:

```tsx
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";
import { LandingFocusDemo } from "@/components/landing/landing-focus-demo";
import { LandingAquariumDemo } from "@/components/landing/landing-aquarium-demo";
import { LandingTelegramDemo } from "@/components/landing/landing-telegram-demo";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFocusDemo />
      <LandingAquariumDemo />
      <LandingTelegramDemo />
    </main>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Live browser verification**

Scroll to the Telegram section on `/` (logged out):
- A voice-note bubble appears, then a "Розпізнаю…" indicator, then a parsed task card with time/effort/priority pills, then it loops back to the voice bubble — full cycle roughly 6.5s.
- With `prefers-reduced-motion: reduce` emulated: the cycle does not auto-advance; a "▶ Показати наступний крок" button appears and manually steps through the three stages on click.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/landing-telegram-demo.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: add Telegram AI capture demo to the coralQ landing page"
```

---

### Task 9: How-it-works steps

**Files:**
- Create: `src/components/landing/landing-steps.tsx`
- Modify: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Consumes: `ScrollReveal` (Task 5).
- Produces: `LandingSteps` — zero-prop component.

- [ ] **Step 1: Build the steps section**

Create `src/components/landing/landing-steps.tsx`:

```tsx
import { ScrollReveal } from "@/components/landing/scroll-reveal";

const STEPS = [
  { n: 1, title: "Постав рівень енергії", body: "Мало сил / В нормі / Повний заряд — займає секунду." },
  { n: 2, title: "Отримай пропозицію у Фокусі", body: "Або накидай задачі голосом чи текстом у Telegram." },
  { n: 3, title: "Заверши без тиску", body: "Вийти можна будь-коли, це теж рахується." },
  { n: 4, title: "Дивись, як росте акваріум", body: "Кожна завершена задача лишає слід — живий, не цифру." },
];

export function LandingSteps() {
  return (
    <section className="bg-sand-soft px-6 py-20">
      <ScrollReveal className="mx-auto max-w-3xl">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Як це працює</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step) => (
            <div key={step.n} className="rounded-[20px] border border-line bg-card p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-sea-soft font-heading text-[15px] font-semibold text-sea-deep">
                {step.n}
              </span>
              <h3 className="mt-3 text-[15px] font-bold text-ink">{step.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
```

- [ ] **Step 2: Wire the steps section into the landing page**

Replace the full contents of `src/components/landing/landing-page.tsx`:

```tsx
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";
import { LandingFocusDemo } from "@/components/landing/landing-focus-demo";
import { LandingAquariumDemo } from "@/components/landing/landing-aquarium-demo";
import { LandingTelegramDemo } from "@/components/landing/landing-telegram-demo";
import { LandingSteps } from "@/components/landing/landing-steps";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFocusDemo />
      <LandingAquariumDemo />
      <LandingTelegramDemo />
      <LandingSteps />
    </main>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Live browser verification**

Scroll to the "Як це працює" section on `/` (logged out):
- 4 numbered cards render in a 2-column grid on desktop widths and stack to 1 column on mobile (`preview_resize` to `mobile`).
- Section fades/rises in on scroll, same as earlier sections.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/landing-steps.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: add how-it-works steps to the coralQ landing page"
```

---

### Task 10: Tech stack section

**Files:**
- Create: `src/components/landing/landing-tech.tsx`
- Modify: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Consumes: `ScrollReveal` (Task 5).
- Produces: `LandingTech` — zero-prop component.

- [ ] **Step 1: Build the tech section**

Create `src/components/landing/landing-tech.tsx`:

```tsx
import { ScrollReveal } from "@/components/landing/scroll-reveal";

const STACK = [
  "Next.js 16",
  "React 19",
  "Supabase",
  "Tailwind CSS v4",
  "grammY (Telegram Bot API)",
  "TypeScript + Zod",
];

const HIGHLIGHTS = [
  "Фокус підбирає задачу локальною сортувальною логікою (дедлайн → пріоритет → час) без зайвих запитів до бази.",
  "Звук моря у фокус-сесії синтезується в браузері через Web Audio API — жодного аудіофайлу.",
  "Голосові та текстові повідомлення з Telegram парсяться в структуровані задачі через бота на grammY.",
  "Уся анімація на цій сторінці — inline SVG та CSS плюс IntersectionObserver, без сторонніх бібліотек для графіки.",
];

export function LandingTech() {
  return (
    <section className="bg-paper px-6 py-20">
      <ScrollReveal className="mx-auto max-w-2xl">
        <h2 className="text-center font-heading text-[26px] font-semibold text-ink">Під капотом</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {STACK.map((item) => (
            <span
              key={item}
              className="rounded-full border border-line bg-card px-3.5 py-1.5 text-[12.5px] font-bold text-ink-soft"
            >
              {item}
            </span>
          ))}
        </div>
        <ul className="mt-8 space-y-3">
          {HIGHLIGHTS.map((line) => (
            <li key={line} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-soft">
              <span className="mt-[3px] size-1.5 shrink-0 rounded-full bg-sea" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </ScrollReveal>
    </section>
  );
}
```

- [ ] **Step 2: Wire the tech section into the landing page**

Replace the full contents of `src/components/landing/landing-page.tsx`:

```tsx
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";
import { LandingFocusDemo } from "@/components/landing/landing-focus-demo";
import { LandingAquariumDemo } from "@/components/landing/landing-aquarium-demo";
import { LandingTelegramDemo } from "@/components/landing/landing-telegram-demo";
import { LandingSteps } from "@/components/landing/landing-steps";
import { LandingTech } from "@/components/landing/landing-tech";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFocusDemo />
      <LandingAquariumDemo />
      <LandingTelegramDemo />
      <LandingSteps />
      <LandingTech />
    </main>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Live browser verification**

Scroll to the "Під капотом" section on `/` (logged out):
- Stack badges render in a centered, wrapping row.
- The 4 highlight lines render below with bullet markers.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/landing-tech.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: add tech stack section to the coralQ landing page"
```

---

### Task 11: Footer CTA + final composition and end-to-end verification

**Files:**
- Create: `src/components/landing/landing-footer-cta.tsx`
- Modify: `src/components/landing/landing-page.tsx`

**Interfaces:**
- Consumes: `Wordmark` from `@/components/gentle/wordmark` (existing, unchanged).
- Produces: `LandingFooterCta` — zero-prop component. `LandingPage` reaches its final, complete composition in this task.

- [ ] **Step 1: Build the footer CTA**

Create `src/components/landing/landing-footer-cta.tsx`:

```tsx
import Link from "next/link";
import { Wordmark } from "@/components/gentle/wordmark";

export function LandingFooterCta() {
  return (
    <section className="bg-sea-deep px-6 py-20 text-center text-white">
      <h2 className="font-heading text-[26px] font-semibold">Спробуй coralQ вже сьогодні</h2>
      <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-white/85">
        Без карток, без тиску — просто зареєструйся і постав перший рівень енергії.
      </p>
      <Link
        href="/login?mode=signup"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-extrabold text-sea-deep shadow-[0_10px_26px_rgba(0,0,0,.25)] transition-transform hover:-translate-y-0.5"
      >
        Спробувати coralQ →
      </Link>
      <footer className="mx-auto mt-14 flex max-w-6xl flex-col items-center gap-3 border-t border-white/15 pt-6 text-[12.5px] text-white/70 sm:flex-row sm:justify-between">
        <span className="text-white">
          <Wordmark />
        </span>
        <span>
          Зроблено з 🪸 ·{" "}
          <a
            href="https://github.com/annaederpro/skelar"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-white"
          >
            Дивитись код на GitHub
          </a>
        </span>
      </footer>
    </section>
  );
}
```

- [ ] **Step 2: Finish the landing page composition**

Replace the full contents of `src/components/landing/landing-page.tsx`:

```tsx
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPhilosophy } from "@/components/landing/landing-philosophy";
import { LandingFocusDemo } from "@/components/landing/landing-focus-demo";
import { LandingAquariumDemo } from "@/components/landing/landing-aquarium-demo";
import { LandingTelegramDemo } from "@/components/landing/landing-telegram-demo";
import { LandingSteps } from "@/components/landing/landing-steps";
import { LandingTech } from "@/components/landing/landing-tech";
import { LandingFooterCta } from "@/components/landing/landing-footer-cta";

export function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-paper">
      <LandingHeader />
      <LandingHero />
      <LandingPhilosophy />
      <LandingFocusDemo />
      <LandingAquariumDemo />
      <LandingTelegramDemo />
      <LandingSteps />
      <LandingTech />
      <LandingFooterCta />
    </main>
  );
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Full end-to-end live verification**

This is the final pass covering the whole spec's "Verification approach" section — walk through all of it on `/` (logged out) in one sitting:
- Hero animation renders and loops; scroll-reveal fires for philosophy, Focus, Aquarium, Telegram, steps, and tech sections in order.
- Focus demo's time-chip → suggested-task → session-preview → celebration flow works end to end.
- Aquarium demo renders real swimming fish and the play/pause control works.
- Telegram loop animates on its own and via the reduced-motion replay button.
- Header crossfades correctly at the hero boundary and stays sticky/clickable the entire way down to the footer.
- Footer CTA and "Дивитись код на GitHub" link both work; footer wordmark is legible (white on `sea-deep`).
- `?mode=signup` deep-link still opens `AuthForm` in signup view (re-check after this task's changes).
- `preview_resize` to `mobile` (375px) and `desktop` (1280px): no horizontal scroll, no overlapping text, step cards and tech badges reflow sensibly at both widths.
- Emulate `prefers-reduced-motion: reduce` and scroll the full page top to bottom: hero fish are static, no bubbles, all sections are immediately visible with no fade-in delay, Telegram demo requires the manual step button.
- Re-confirm the routing split from Task 1: `/` still serves the landing when logged out and redirects to `/today` when logged in (use real credentials if available); `/login` and `/login?mode=signup` unaffected.
- No console errors anywhere on the page.

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/landing-footer-cta.tsx src/components/landing/landing-page.tsx
git commit --no-gpg-sign -m "feat: add footer CTA and finish the coralQ landing page composition"
```

## Self-Review

- **Spec coverage:** Routing/middleware split → Task 1. Living Ocean hero → Task 2. Persistent header for fast login/signup → Task 3. `?mode=signup` deep link → Task 4. Philosophy bridge → Task 5. Focus/Aquarium/Telegram demos → Tasks 6–8. How-it-works steps → Task 9. Tech stack section → Task 10. Footer CTA/repo link + final reduced-motion and end-to-end audit → Task 11. All 8 sections plus the header from the approved page-flow are present in `LandingPage`'s final composition (Task 11, Step 2). Every self-authored assumption from the spec (fixed demo energy level 2, sample task list, GitHub footer link, placeholder-quality copy) is reflected in the code as written. ✓
- **Placeholder scan:** No TBD/TODO markers; every step ships complete, real code (including full sample data, full copy, full CSS). ✓
- **Type consistency:** `ScrollReveal({ children, className? })` — same signature used identically in Tasks 6–10. `usePrefersReducedMotion(): boolean` — same signature used in Task 2 (ocean scene) and Task 8 (Telegram demo). `AquariumTank` and `CelebrationModal` props match their existing, unmodified definitions in `src/components/gentle/`. `LandingPage` stays a zero-prop component with the same export name across every task that touches it. The `#hero-end` id is produced once (Task 2) and consumed once (Task 3), name matches exactly. ✓
