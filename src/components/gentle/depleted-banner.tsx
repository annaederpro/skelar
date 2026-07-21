import { Waves } from "lucide-react";

export function DepletedBanner() {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-coral-soft bg-coral-soft/60 px-4 py-3 text-coral">
      <Waves className="size-5 shrink-0" />
      <p className="text-sm leading-relaxed">
        Сьогодні день для відновлення. Важкі справи відпочивають — покажемо
        лише легкі задачі.
      </p>
    </div>
  );
}
