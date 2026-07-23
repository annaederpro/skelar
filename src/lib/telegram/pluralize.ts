// Ukrainian count-noun agreement for "задача": 1 → задачу, 2-4 → задачі
// (except the 12-14 exception), everything else → задач.
export function pluralizeTasks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "задачу";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "задачі";
  return "задач";
}
