import type { DbTask } from "@/types/gentle";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// "2026-07-23" -> "20260723"
function formatIcsDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

// "2026-07-23", "14:30:00" -> "20260723T143000"
function formatIcsDateTime(isoDate: string, time: string): string {
  const [h, m, s] = time.split(":");
  return `${formatIcsDate(isoDate)}T${h}${m}${s ?? "00"}`;
}

// "2026-07-23" + 1 -> "2026-07-24" (UTC arithmetic so DST can't shift the day)
function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

// Adds `minutes` to a floating local date+time, returning the new date/time parts.
function addMinutesToDateTime(
  isoDate: string,
  time: string,
  minutes: number,
): { date: string; time: string } {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi, s] = time.split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, s || 0);
  dt.setMinutes(dt.getMinutes() + minutes);
  return {
    date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
    time: `${pad(dt.getHours())}${pad(dt.getMinutes())}${pad(dt.getSeconds())}`,
  };
}

// Builds a single-event .ics file for one task. Throws if the task has no due_date —
// callers only invoke this when a due_date is known to exist (see task-card.tsx).
export function buildTaskIcs(task: DbTask): string {
  if (!task.due_date) {
    throw new Error("buildTaskIcs requires a task with a due_date");
  }

  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  let dtstart: string;
  let dtend: string;

  if (task.due_time) {
    dtstart = `DTSTART:${formatIcsDateTime(task.due_date, task.due_time)}`;
    const end = addMinutesToDateTime(task.due_date, task.due_time, task.duration_minutes);
    dtend = `DTEND:${formatIcsDate(end.date)}T${end.time}`;
  } else {
    dtstart = `DTSTART;VALUE=DATE:${formatIcsDate(task.due_date)}`;
    dtend = `DTEND;VALUE=DATE:${formatIcsDate(addDaysToIsoDate(task.due_date, 1))}`;
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//coralQ//task export//EN",
    "BEGIN:VEVENT",
    `UID:${task.id}@coralq`,
    `DTSTAMP:${dtstamp}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeIcsText(task.title)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n") + "\r\n";
}

// "Купити квитки!" -> "купити-квитки.ics"; empty slug falls back to "task.ics"
export function taskIcsFilename(task: DbTask): string {
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "task"}.ics`;
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
