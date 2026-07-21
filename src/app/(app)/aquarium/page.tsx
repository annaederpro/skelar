import { createClient } from "@/lib/supabase/server";

function pluralizeMeshkanets(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "мешканець";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "мешканці";
  return "мешканців";
}

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

  const FISH_SHOWN_MAX = 30;
  const EGG_SHOWN_MAX = 12;

  return (
    <div className="flex flex-col gap-4 rounded-[22px] border border-line bg-card px-4 py-6">
      <div className="text-center">
        <h2 className="font-heading text-lg font-semibold">Твій акваріум</h2>
        <p className="text-sm text-ink-soft">
          {fish} {pluralizeMeshkanets(fish)} — по одному на кожну виконану задачу
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2 rounded-2xl bg-sea-soft/40 p-4">
        {Array.from({ length: Math.min(fish, FISH_SHOWN_MAX) }).map((_, i) => (
          <span key={i} className="text-2xl" aria-hidden>
            🐠
          </span>
        ))}
        {fish > FISH_SHOWN_MAX && (
          <span className="self-center text-sm font-semibold text-sea-deep">
            +{fish - FISH_SHOWN_MAX}
          </span>
        )}
      </div>

      {eggs > 0 && (
        <div>
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Ікринки, що чекають на тебе
          </p>
          <div className="flex flex-wrap justify-center gap-2 rounded-2xl bg-coral-soft/40 p-4">
            {Array.from({ length: Math.min(eggs, EGG_SHOWN_MAX) }).map((_, i) => (
              <span key={i} className="text-2xl" aria-hidden>
                🥚
              </span>
            ))}
            {eggs > EGG_SHOWN_MAX && (
              <span className="self-center text-sm font-semibold text-coral">
                +{eggs - EGG_SHOWN_MAX}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
