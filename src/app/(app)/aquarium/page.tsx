import { createClient } from "@/lib/supabase/server";
import { SPECIES } from "@/lib/aquarium-species";
import { AquariumTank } from "@/components/gentle/aquarium-tank";

function pluralizeMeshkanets(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "мешканець";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "мешканці";
  return "мешканців";
}

// Fixed swim lanes are capped at 8 (see AquariumTank) so at most 8 swimmers render.
const MAX_SWIMMERS = 8;

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
  const swimmerCount = Math.min(fish, MAX_SWIMMERS);

  return (
    <div className="flex flex-col gap-4">
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

      <AquariumTank eggs={eggs} unlocked={unlocked} swimmerCount={swimmerCount} />

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

        <p className="mt-3 text-center text-[10.5px] text-ink-soft">
          Іконки частково —{" "}
          <a
            href="https://github.com/jdecked/twemoji"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Twemoji
          </a>{" "}
          · CC-BY 4.0
        </p>
      </div>
    </div>
  );
}
