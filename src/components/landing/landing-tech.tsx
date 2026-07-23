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
