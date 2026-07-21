import { createClient } from "@/lib/supabase/server";

function pluralizeMeshkanets(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "мешканець";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "мешканці";
  return "мешканців";
}

// 12 species, unlocked progressively by total completed-task count.
// Icons share a 38x30 viewBox so the same JSX renders in the tank and the grid.
const SPECIES: { name: string; threshold: number; icon: React.ReactNode }[] = [
  {
    name: "Клоун",
    threshold: 1,
    icon: (
      <>
        <path d="M6 15 q11 -9 22 0 q-11 9 -22 0Z" fill="#E7936F" />
        <path d="M28 15 l7 -4 v8Z" fill="#DF8464" />
        <rect x="14" y="8" width="3" height="14" fill="#fff" />
        <circle cx="11" cy="13" r="1.4" fill="#33403E" />
      </>
    ),
  },
  {
    name: "Морський коник",
    threshold: 6,
    icon: (
      <>
        <path
          d="M14 6 q7 -2 7 5 q0 6 -6 8 q-5 2 -4 8"
          fill="none"
          stroke="#C58BB0"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="14" cy="7" r="2.2" fill="#C58BB0" />
      </>
    ),
  },
  {
    name: "Зірка",
    threshold: 12,
    icon: <path d="M18 5 l3 8 8 1 -6 6 2 8 -7 -4 -7 4 2 -8 -6 -6 8 -1Z" fill="#DF8464" />,
  },
  {
    name: "Хірург",
    threshold: 20,
    icon: (
      <>
        <path d="M6 15 q11 -9 22 0 q-11 9 -22 0Z" fill="#5CB0AE" />
        <path d="M28 15 l7 -4 v8Z" fill="#EBD98A" />
        <circle cx="11" cy="13" r="1.4" fill="#1E4E56" />
      </>
    ),
  },
  {
    name: "Медуза",
    threshold: 30,
    icon: (
      <>
        <path d="M10 13 q9 -12 18 0 q-2 3 -9 3 q-7 0 -9 -3Z" fill="#B98AC0" opacity=".85" />
        <path
          d="M13 16 q0 6 -1 10 M19 17 q0 6 0 10 M25 16 q1 6 1 10"
          stroke="#C9A0CF"
          strokeWidth="2"
          fill="none"
          opacity=".7"
        />
      </>
    ),
  },
  {
    name: "Черепаха",
    threshold: 42,
    icon: (
      <>
        <ellipse cx="17" cy="16" rx="11" ry="8" fill="#4FA0A0" />
        <ellipse cx="29" cy="14" rx="4.5" ry="3.5" fill="#5FB0AE" />
        <circle cx="31" cy="13" r=".9" fill="#1E4E56" />
        <ellipse cx="9" cy="22" rx="3" ry="2" fill="#5FB0AE" />
        <ellipse cx="24" cy="23" rx="3" ry="2" fill="#5FB0AE" />
      </>
    ),
  },
  {
    name: "Краб",
    threshold: 56,
    icon: (
      <>
        <ellipse cx="19" cy="17" rx="8" ry="6" fill="#DF8464" />
        <circle cx="16" cy="15" r="1" fill="#33403E" />
        <circle cx="22" cy="15" r="1" fill="#33403E" />
        <path
          d="M11 14 q-4 -2 -5 -6 M27 14 q4 -2 5 -6"
          stroke="#DF8464"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="6" cy="7" r="2.5" fill="#E7936F" />
        <circle cx="32" cy="7" r="2.5" fill="#E7936F" />
      </>
    ),
  },
  {
    name: "Риба-їжак",
    threshold: 72,
    icon: (
      <>
        <circle cx="17" cy="15" r="8" fill="#EBD98A" />
        <g stroke="#D9C46A" strokeWidth="1.6" strokeLinecap="round">
          <path d="M17 4 v3 M17 23 v3 M6 15 h3 M25 15 h3 M9 7 l2 2 M25 21 l2 2 M9 23 l2 -2 M25 9 l2 -2" />
        </g>
        <circle cx="14" cy="13" r="1.2" fill="#33403E" />
      </>
    ),
  },
  {
    name: "Актинія",
    threshold: 90,
    icon: (
      <>
        <g stroke="#B98AC0" strokeWidth="3" strokeLinecap="round">
          <path d="M12 24 q-2 -8 -4 -10 M16 24 q0 -9 -1 -12 M20 24 q1 -9 2 -12 M24 24 q3 -7 5 -9" />
        </g>
        <ellipse cx="18" cy="25" rx="9" ry="3" fill="#C58BB0" />
      </>
    ),
  },
  {
    name: "Скат",
    threshold: 110,
    icon: (
      <>
        <path
          d="M5 13 q13 -9 28 1 q-9 2 -12 1 l-2 9 -3 -8 q-6 0 -11 -3Z"
          fill="#9FC7C9"
        />
        <circle cx="13" cy="12" r="1" fill="#1E4E56" />
      </>
    ),
  },
  {
    name: "Дельфін",
    threshold: 132,
    icon: (
      <>
        <path
          d="M5 18 q6 -10 10 -6 l3 -5 1 6 q9 0 13 7 q-8 4 -14 2 q-2 4 -5 3 l1 -4 q-6 0 -9 -3Z"
          fill="#5CB0AE"
        />
        <circle cx="27" cy="16" r=".9" fill="#1E4E56" />
      </>
    ),
  },
  {
    name: "Кит",
    threshold: 156,
    icon: (
      <>
        <path d="M4 18 q1 -9 14 -9 q13 0 16 8 q-3 5 -12 5 q-13 0 -18 -4Z" fill="#3E8E9C" />
        <path
          d="M25 6 q1 3 0 4 M28 5 q0 3 -1 5"
          stroke="#8FC6CD"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="10" cy="15" r="1.1" fill="#fff" />
      </>
    ),
  },
];

// Fixed swim lanes (top px inside the 210px tank, duration s, delay s, direction).
const LANES = [
  { top: 38, dur: 14, delay: 0, dir: 1 },
  { top: 88, dur: 18, delay: 3, dir: -1 },
  { top: 128, dur: 12, delay: 1.5, dir: 1 },
  { top: 148, dur: 20, delay: 6, dir: -1 },
  { top: 58, dur: 16, delay: 4, dir: 1 },
  { top: 108, dur: 15, delay: 2, dir: -1 },
  { top: 73, dur: 19, delay: 5, dir: 1 },
  { top: 138, dur: 13, delay: 7, dir: -1 },
];

const TANK_CSS = `
.aq-tank{position:relative;height:210px;border-radius:24px;overflow:hidden;border:1px solid var(--line);
  background:linear-gradient(180deg,#BFE6E8 0%,#9CD2D8 60%,#8FC6CD 100%)}
.aq-rays{position:absolute;inset:0;pointer-events:none;opacity:.5;
  background:linear-gradient(115deg,rgba(255,255,255,.35) 0 6%,transparent 12% 22%,rgba(255,255,255,.25) 24% 30%,transparent 34%)}
.aq-swimmer{position:absolute;will-change:left}
.aq-bob{animation:aq-bob 3s ease-in-out infinite}
@keyframes aq-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes aq-swim-r{from{left:-70px}to{left:100%}}
@keyframes aq-swim-l{from{left:100%}to{left:-70px}}
.aq-bubble{position:absolute;bottom:8px;border-radius:50%;background:rgba(255,255,255,.5);animation:aq-bubble linear infinite}
@keyframes aq-bubble{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:.7}100%{transform:translateY(-190px) scale(1);opacity:0}}
@media (prefers-reduced-motion:reduce){.aq-swimmer,.aq-bob,.aq-bubble{animation:none!important}}
`;

export default async function AquariumPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const [{ count: fishCount }, { count: eggCount }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "todo")
      .eq("is_seeded", true),
  ]);

  const fish = fishCount ?? 0;
  const eggs = eggCount ?? 0;

  if (fish === 0 && eggs === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[22px] border border-line bg-card px-4 py-14 text-center">
        <span className="text-4xl">🐠</span>
        <h2 className="font-heading text-lg font-semibold">Твій акваріум</h2>
        <p className="max-w-[240px] text-sm leading-relaxed text-ink-soft">
          Тут оживатиме риф: кожна виконана задача додаватиме мешканця. Незабаром.
        </p>
      </div>
    );
  }

  const unlocked = SPECIES.filter((s) => fish >= s.threshold);
  const nextSpecies = SPECIES.find((s) => fish < s.threshold);
  const swimmerCount = Math.min(fish, LANES.length);

  return (
    <div className="flex flex-col gap-4">
      <style>{TANK_CSS}</style>

      <h2 className="mx-0.5 font-heading text-2xl font-semibold">Твій акваріум</h2>

      {/* stats */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-2xl border border-line bg-card px-2 py-2.5 text-center">
          <div className="font-heading text-xl font-semibold leading-none">{fish}</div>
          <div className="mt-1 text-[11px] text-ink-soft">{pluralizeMeshkanets(fish)}</div>
        </div>
        <div className="flex-1 rounded-2xl border border-line bg-card px-2 py-2.5 text-center">
          <div className="font-heading text-xl font-semibold leading-none">{eggs}</div>
          <div className="mt-1 text-[11px] text-ink-soft">
            {eggs === 1 ? "ікринка чекає" : "ікринки чекають"}
          </div>
        </div>
        <div className="flex-1 rounded-2xl border border-line bg-card px-2 py-2.5 text-center">
          <div className="font-heading text-xl font-semibold leading-none">
            {unlocked.length}
            <span className="text-[13px] text-ink-soft">/{SPECIES.length}</span>
          </div>
          <div className="mt-1 text-[11px] text-ink-soft">видів зібрано</div>
        </div>
      </div>

      {/* tank */}
      <div className="aq-tank">
        <div className="aq-rays" />
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 390 120"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 70 Q100 56 200 66 T390 62 V120 H0Z" fill="#E7D9BC" />
          <path d="M0 88 Q120 78 230 86 T390 82 V120 H0Z" fill="#D8C7A2" opacity=".6" />
          <g>
            <path d="M40 90 q-8 -22 2 -40 q6 16 -2 40Z" fill="#3E8E9C" opacity=".8" />
            <path d="M50 92 q10 -18 4 -34 q-10 14 -4 34Z" fill="#4FA0A0" opacity=".75" />
            <path d="M320 92 q-10 -20 0 -38 q8 16 0 38Z" fill="#4FA0A0" opacity=".8" />
            <path d="M330 93 q10 -16 2 -30 q-9 12 -2 30Z" fill="#3E8E9C" opacity=".7" />
            <g transform="translate(190,86)">
              <path
                d="M0 6 C-16 6 -18 -6 -8 -8 C-2 -14 12 -12 12 -2 C20 -2 18 8 8 8Z"
                fill="#E7936F"
                opacity=".9"
              />
              <path d="M-6 4 C-10 -2 -2 -6 2 -2" stroke="#F3B39A" strokeWidth="2" fill="none" />
            </g>
            <g transform="translate(150,90)">
              <circle cx="0" cy="0" r="4" fill="#DF8464" />
              <circle cx="7" cy="-2" r="3" fill="#E7936F" />
              <circle cx="-6" cy="-1" r="3" fill="#E7936F" />
            </g>
            {/* eggs resting on the sand, one per seeded task (up to 3 shown) */}
            {Array.from({ length: Math.min(eggs, 3) }).map((_, i) => (
              <g key={i} transform={`translate(${255 + i * 18},${92 - (i % 2) * 3})`}>
                <ellipse cx="0" cy="0" rx="6" ry="7.5" fill="#EAF6F5" />
                <ellipse cx="0" cy="0" rx="2.4" ry="3" fill="#9FC7C9" />
              </g>
            ))}
          </g>
        </svg>

        {LANES.slice(0, swimmerCount).map((lane, i) => {
          const species = unlocked[i % Math.max(unlocked.length, 1)] ?? SPECIES[0];
          return (
            <div
              key={i}
              className="aq-swimmer"
              style={{
                top: lane.top,
                animation: `${lane.dir > 0 ? "aq-swim-r" : "aq-swim-l"} ${lane.dur}s linear ${lane.delay}s infinite`,
              }}
            >
              <div style={lane.dir < 0 ? { transform: "scaleX(-1)" } : undefined}>
                <div className="aq-bob" style={{ animationDuration: `${2.4 + (i % 4) * 0.4}s` }}>
                  <svg width="42" height="33" viewBox="0 0 38 30" aria-hidden>
                    {species.icon}
                  </svg>
                </div>
              </div>
            </div>
          );
        })}

        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className="aq-bubble"
            style={{
              left: `${10 + ((i * 13) % 80)}%`,
              width: 5 + (i % 3) * 3,
              height: 5 + (i % 3) * 3,
              animationDuration: `${5 + (i % 4)}s`,
              animationDelay: `${i * 0.7}s`,
            }}
          />
        ))}
      </div>

      {/* collection */}
      <div>
        <div className="mx-0.5 mb-2.5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Колекція видів
          </span>
          <span className="text-xs text-ink-soft">
            {unlocked.length} / {SPECIES.length}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {SPECIES.map((s) => {
            const isUnlocked = fish >= s.threshold;
            return (
              <div
                key={s.name}
                className={
                  isUnlocked
                    ? "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-card"
                    : "relative flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-[#EFF4F1]"
                }
              >
                {!isUnlocked && (
                  <svg
                    className="absolute right-1.5 top-1.5 text-[#C1CCC7]"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden
                  >
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                )}
                <svg
                  width="38"
                  height="30"
                  viewBox="0 0 38 30"
                  opacity={isUnlocked ? 1 : 0.3}
                  aria-hidden
                >
                  {isUnlocked ? (
                    s.icon
                  ) : (
                    <>
                      <path d="M6 15 q11 -9 22 0 q-11 9 -22 0Z" fill="#7FA0A0" />
                      <path d="M28 15 l7 -4 v8Z" fill="#7FA0A0" />
                    </>
                  )}
                </svg>
                <span
                  className={
                    isUnlocked
                      ? "px-1 text-center text-[9.5px] font-bold leading-tight text-ink-soft"
                      : "px-1 text-center text-[9.5px] font-bold leading-tight text-[#B7C2BD]"
                  }
                >
                  {s.name}
                </span>
              </div>
            );
          })}
        </div>

        {nextSpecies ? (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl bg-sea-soft px-4 py-3 text-[13.5px] font-medium leading-relaxed text-sea-deep">
            <span>🎁</span>
            <span>
              Ще{" "}
              <b>
                {nextSpecies.threshold - fish}{" "}
                {pluralizeMeshkanets(nextSpecies.threshold - fish)}
              </b>{" "}
              — і у твоєму акваріумі з&apos;явиться новий вид: <b>{nextSpecies.name}</b>. Без
              поспіху: акваріум наповнюється у твоєму темпі.
            </span>
          </div>
        ) : (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl bg-sea-soft px-4 py-3 text-[13.5px] font-medium leading-relaxed text-sea-deep">
            <span>🏆</span>
            <span>Усі види зібрано. Твій риф — повний життя.</span>
          </div>
        )}
      </div>
    </div>
  );
}
