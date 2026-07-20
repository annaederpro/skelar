"use client";

import { BatteryLow, BatteryMedium, BatteryFull } from "lucide-react";
import type { ResourceStatus } from "@/types/gentle";
import { cn } from "@/lib/utils";

interface ResourceStatusToggleProps {
  value: ResourceStatus;
  onChange: (value: ResourceStatus) => void;
}

const OPTIONS: {
  value: ResourceStatus;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}[] = [
  {
    value: "depleted",
    label: "Виснажена",
    icon: BatteryLow,
    activeClass: "bg-rose-100 text-rose-700",
  },
  {
    value: "normal",
    label: "В нормі",
    icon: BatteryMedium,
    activeClass: "bg-amber-100 text-amber-700",
  },
  {
    value: "high",
    label: "Повна сил",
    icon: BatteryFull,
    activeClass: "bg-emerald-100 text-emerald-700",
  },
];

export function ResourceStatusToggle({
  value,
  onChange,
}: ResourceStatusToggleProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm text-muted-foreground">Як ти сьогодні?</span>
      <div
        role="radiogroup"
        aria-label="Рівень ресурсу"
        className="flex items-center gap-1 rounded-full bg-muted p-1"
      >
        {OPTIONS.map(({ value: v, label, icon: Icon, activeClass }) => {
          const isActive = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
                isActive && activeClass,
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
