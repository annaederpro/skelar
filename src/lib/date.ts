const APP_TIMEZONE = "Europe/Kyiv";

export function getAppToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}
