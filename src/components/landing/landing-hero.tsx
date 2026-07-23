import Link from "next/link";
import { LandingOceanScene } from "@/components/landing/landing-ocean-scene";

function HeroWordmark() {
  return (
    <span className="flex items-center justify-center font-heading text-[42px] font-semibold tracking-tight text-ink sm:text-[54px]">
      coral
      <svg width="52" height="62" viewBox="0 0 100 120" fill="none" className="relative top-2.5 ml-0.5" aria-hidden>
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
      <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
        <HeroWordmark />
        <p className="max-w-xs text-[16px] leading-relaxed text-ink-soft sm:max-w-sm sm:text-[18px]">
          Продуктивність без тиску — росте разом із тобою.
        </p>
        <Link
          href="/login?mode=signup"
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-sea-deep px-7 py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_26px_rgba(46,63,61,.22)] transition-transform hover:-translate-y-0.5"
        >
          Спробувати →
        </Link>
      </div>
      <div id="hero-end" className="absolute bottom-0 left-0 right-0 h-px" aria-hidden />
    </section>
  );
}
