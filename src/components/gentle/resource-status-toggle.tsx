"use client";

import type { ResourceStatus } from "@/types/gentle";
import { cn } from "@/lib/utils";

interface ResourceStatusToggleProps {
  value: ResourceStatus;
  onChange: (value: ResourceStatus) => void;
}

const OPTIONS: {
  value: ResourceStatus;
  label: string;
  activeClass: string;
}[] = [
  {
    value: "depleted",
    label: "Мало сил",
    activeClass: "bg-coral-soft text-coral shadow-[0_6px_18px_rgba(223,132,100,.26)]",
  },
  {
    value: "normal",
    label: "В нормі",
    activeClass: "bg-sea-soft text-sea-deep shadow-[0_6px_18px_rgba(62,142,156,.22)]",
  },
  {
    value: "high",
    label: "Повний заряд",
    activeClass: "bg-anem-soft text-anem shadow-[0_6px_18px_rgba(185,138,192,.26)]",
  },
];

export function ResourceStatusToggle({
  value,
  onChange,
}: ResourceStatusToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Рівень енергії"
      className="grid w-full grid-cols-3 gap-2.5"
    >
      {OPTIONS.map(({ value: v, label, activeClass }) => {
        const isActive = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(v)}
            className={cn(
              "rounded-[20px] border-[1.5px] px-1.5 pb-2.5 pt-3 text-center text-[13px] font-bold shadow-sm transition-all",
              isActive
                ? cn("-translate-y-0.5 border-transparent", activeClass)
                : "border-line bg-card text-ink-soft hover:-translate-y-0.5",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
