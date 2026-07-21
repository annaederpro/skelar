"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  formatMonthLabel,
  getWeekDates,
  getWeekStart,
  mondayIndex,
  WEEKDAY_SHORT,
} from "@/lib/upcoming-date";
import { cn } from "@/lib/utils";

interface WeekStripProps {
  today: string;
  busyDates: Set<string>;
  onSelectDate: (date: string) => void;
}

export function WeekStrip({ today, busyDates, onSelectDate }: WeekStripProps) {
  const currentWeekStart = getWeekStart(today);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const weekDates = getWeekDates(weekStart);
  const isCurrentWeek = weekStart === currentWeekStart;

  return (
    <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between px-1">
        <span className="font-heading text-[15px] font-medium text-ink">
          {formatMonthLabel(weekStart)}
        </span>
        <div className="flex items-center gap-1">
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => setWeekStart(currentWeekStart)}
              className="mr-1 text-[12.5px] font-bold text-sea-deep"
            >
              Сьогодні
            </button>
          )}
          <button
            type="button"
            aria-label="Попередній тиждень"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="flex size-7 items-center justify-center rounded-full text-ink-soft hover:bg-paper"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Наступний тиждень"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="flex size-7 items-center justify-center rounded-full text-ink-soft hover:bg-paper"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((date) => {
          const isToday = date === today;
          const isBusy = busyDates.has(date);
          const dayNum = Number(date.slice(-2));
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className="flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors hover:bg-paper"
            >
              <span className="text-[11px] font-bold uppercase text-ink-soft">
                {WEEKDAY_SHORT[mondayIndex(date)]}
              </span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-[13.5px] font-bold",
                  isToday ? "bg-coral text-white" : "text-ink",
                )}
              >
                {dayNum}
              </span>
              <span
                className={cn("size-[5px] rounded-full", isBusy ? "bg-sea" : "bg-transparent")}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
