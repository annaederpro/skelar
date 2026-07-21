const MONTH_ABBR = [
  "січ", "лют", "бер", "кві", "тра", "чер",
  "лип", "сер", "вер", "жов", "лис", "гру",
];
const MONTH_FULL = [
  "Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень",
];
// Monday-indexed (0 = Monday .. 6 = Sunday)
export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const WEEKDAY_FULL = [
  "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота", "неділя",
];

// "2026-07-22" + 1 → "2026-07-23". UTC-based so the local machine's DST
// never shifts the calendar date the string represents.
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 0 (Monday) .. 6 (Sunday), converted from JS's native 0=Sunday.
export function mondayIndex(isoDate: string): number {
  const jsDay = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function getWeekStart(isoDate: string): string {
  return addDays(isoDate, -mondayIndex(isoDate));
}

export function getWeekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatMonthLabel(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${MONTH_FULL[Number(month) - 1]} ${year}`;
}

// "2026-07-22" → "22 лип · Завтра" (or "23 лип · четвер" for any other day)
export function formatDayHeader(isoDate: string, today: string): string {
  const [, month, day] = isoDate.split("-");
  const relative =
    isoDate === addDays(today, 1) ? "Завтра" : WEEKDAY_FULL[mondayIndex(isoDate)];
  return `${Number(day)} ${MONTH_ABBR[Number(month) - 1]} · ${relative}`;
}
