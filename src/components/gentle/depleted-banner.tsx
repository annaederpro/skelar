import { Sprout } from "lucide-react";

export function DepletedBanner() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-rose-800">
      <Sprout className="size-5 shrink-0" />
      <p className="text-sm leading-relaxed">
        Сьогодні день для відновлення. Важкі справи відпочивають — покажемо
        лише легкі задачі.
      </p>
    </div>
  );
}
