// Plain calendar days as "YYYY-MM-DD" strings. The server says which day is today
// in the member's timezone; these helpers only count days, so no timezone math here.

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parse(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const date = parse(day);
  date.setUTCDate(date.getUTCDate() + n);
  return format(date);
}

/** 0 = Monday … 6 = Sunday, like the API's class weekdays */
export function weekday(day: string): number {
  return (parse(day).getUTCDay() + 6) % 7;
}

export function mondayOf(day: string): string {
  return addDays(day, -weekday(day));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

export const weekdayName = (day: string) => WEEKDAYS[weekday(day)];
export const shortWeekday = (day: string) => WEEKDAYS[weekday(day)].slice(0, 3);
export const dayNumber = (day: string) => parse(day).getUTCDate();
export const monthShort = (day: string) => MONTHS[parse(day).getUTCMonth()];

/** "16–22 Nov" or "28 Nov – 4 Dec" */
export function rangeLabel(start: string, end: string): string {
  if (monthShort(start) === monthShort(end)) return `${dayNumber(start)}–${dayNumber(end)} ${monthShort(end)}`;
  return `${dayNumber(start)} ${monthShort(start)} – ${dayNumber(end)} ${monthShort(end)}`;
}

/** Local wall-clock time of an ISO instant, as HH:MM, in this browser's timezone */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The local calendar day of an ISO instant, in this browser's timezone */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Fri 20 Nov, 09:00" */
export function whenLabel(iso: string): string {
  const day = localDay(iso);
  return `${shortWeekday(day)} ${dayNumber(day)} ${monthShort(day)}, ${clockTime(iso)}`;
}

/** An ISO instant for a local date and HH:MM in this browser's timezone */
export function localInstant(day: string, time: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

export function minutesLabel(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} h ${m} min`;
  return h ? `${h} h` : `${m} min`;
}
