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
