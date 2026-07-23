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
