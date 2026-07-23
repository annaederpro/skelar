import Link from "next/link";
import { LandingOceanScene } from "@/components/landing/landing-ocean-scene";

export function LandingHero() {
  return (
    <section className="relative flex min-h-dvh items-center justify-center overflow-hidden">
      <LandingOceanScene />
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
        <h1 className="max-w-2xl font-heading text-[32px] font-semibold leading-tight text-ink sm:text-[42px]">
          Лагідний таск-менеджер, що росте разом із тобою
        </h1>
        <p className="max-w-md text-[16px] leading-relaxed text-sea-deep sm:text-[18px]">
          Вивали все з голови — ШІ розкладе це на задачі, а coralQ дасть рівно стільки, скільки ти зараз потягнеш.
        </p>
        <Link
          href="/login?mode=signup"
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-sea-deep px-7 py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_26px_rgba(46,63,61,.22)] transition-transform hover:-translate-y-0.5"
        >
          Спробувати безкоштовно →
        </Link>
      </div>
      <div id="hero-end" className="absolute bottom-0 left-0 right-0 h-px" aria-hidden />
    </section>
  );
}
