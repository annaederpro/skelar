import Link from "next/link";
import { Wordmark } from "@/components/gentle/wordmark";

export function LandingFooterCta() {
  return (
    <section className="bg-sea-soft px-6 py-20 text-center text-ink">
      <h2 className="font-heading text-[26px] font-semibold">Спробуй coralQ вже сьогодні</h2>
      <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-ink-soft">
        Без карток, без тиску — просто зареєструйся і постав перший рівень енергії.
      </p>
      <Link
        href="/login?mode=signup"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-sea-deep px-7 py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_26px_rgba(46,63,61,.22)] transition-transform hover:-translate-y-0.5"
      >
        Спробувати coralQ →
      </Link>
      <footer className="mx-auto mt-14 flex max-w-6xl flex-col items-center gap-3 border-t border-line pt-6 text-[12.5px] text-ink-soft sm:flex-row sm:justify-between">
        <Wordmark />
        <a
          href="https://github.com/annaederpro/skelar"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-ink"
        >
          Дивитись код на GitHub
        </a>
      </footer>
    </section>
  );
}
