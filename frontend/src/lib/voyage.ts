// The voyage's rules, kept free of React so they can be tested on their own
import { addDays, daysBetween, localDay, shortWeekday, weekdayName, dayNumber, minutesLabel } from "./dates";
import type { Boss, DayPlan, DayRecord, Guardian, Task } from "./types";

export const DEFAULT_ESTIMATE = 45;

// ---------- Map layout ----------
export type MapVariant = "phone" | "desktop";

export interface IslandSpot {
  x: number;
  y: number;
  shape: "isle" | "peak";
}

/** Seven islands along the trail, Monday first; positions are in the map's viewBox units. */
const SPOTS: Record<MapVariant, { width: number; height: number; points: [number, number][] }> = {
  phone: {
    width: 390,
    height: 490,
    points: [[82, 58], [268, 104], [118, 176], [284, 240], [104, 306], [272, 370], [126, 430]],
  },
  desktop: {
    width: 760,
    height: 520,
    points: [[90, 300], [190, 190], [300, 300], [400, 180], [500, 300], [600, 190], [690, 310]],
  },
};

export function mapSize(variant: MapVariant) {
  const { width, height } = SPOTS[variant];
  return { width, height };
}

export function islandLayout(variant: MapVariant): IslandSpot[] {
  return SPOTS[variant].points.map(([x, y], i) => ({ x, y, shape: i % 2 === 0 ? "isle" : "peak" }));
}

/** A smooth path through the islands, for the red dotted trail */
export function trailPath(spots: IslandSpot[]): string {
  if (spots.length === 0) return "";
  let d = `M${spots[0].x},${spots[0].y}`;
  for (let i = 1; i < spots.length; i++) {
    const a = spots[i - 1];
    const b = spots[i];
    const midY = (a.y + b.y) / 2;
    d += ` C${a.x},${midY} ${b.x},${midY} ${b.x},${b.y}`;
  }
  return d;
}

// ---------- Day islands ----------
export type DayKind = "cleared" | "past" | "today" | "boss" | "fog" | "open";

export interface DayState {
  kind: DayKind;
  isToday: boolean;
  quests: Task[];
  done: number;
  exams: Task[];
}

export const isExam = (t: Task) => t.kind === "exam";

export function dayState(day: DayPlan, today: string, lifted: ReadonlySet<string> = new Set()): DayState {
  const quests = day.tasks.filter((t) => !isExam(t));
  const done = quests.filter((t) => t.status === "completed").length;
  const exams = [...day.tasks, ...day.due].filter(isExam).filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i);
  const isToday = day.date === today;
  const past = day.date < today;
  const base = { isToday, quests, done, exams };

  if (quests.length > 0 && done === quests.length && !(day.date > today)) return { kind: "cleared", ...base };
  if (exams.some((e) => e.status !== "completed") && !past) return { kind: "boss", ...base };
  if (isToday) return { kind: "today", ...base };
  if (past) return { kind: "past", ...base };
  const empty = quests.length === 0 && day.due.length === 0 && day.classes.length === 0;
  if (empty && !lifted.has(day.date)) return { kind: "fog", ...base };
  return { kind: "open", ...base };
}

export function questCount(n: number): string {
  return `${n} ${n === 1 ? "quest" : "quests"}`;
}

/** The words on an island's card: eyebrow, title and one line */
export function islandCard(day: DayPlan, state: DayState): { eyebrow: string; title: string; line: string } {
  const name = `${weekdayName(day.date)} ${dayNumber(day.date)}`;
  const classes = day.classes.length ? `${day.classes.length} ${day.classes.length === 1 ? "class" : "classes"}` : "";
  const progress = `${state.done} of ${questCount(state.quests.length)} done`;
  switch (state.kind) {
    case "cleared":
      return { eyebrow: `${name} · cleared`, title: "Chest opened", line: progress };
    case "boss": {
      const exam = state.exams[0];
      return {
        eyebrow: `${name}${state.isToday ? " · today" : ""} · exam day`,
        title: `${guardianName(exam.guardian)} guards this reef`,
        line: [exam.title, classes].filter(Boolean).join(" · "),
      };
    }
    case "fog":
      return { eyebrow: `${name} · uncharted`, title: "Hidden in the fog", line: "Chart this day to lift the fog and plan it" };
    case "past":
      return {
        eyebrow: `${name} · behind you`,
        title: state.quests.length ? progress : "Quiet waters",
        line: state.quests.length > state.done ? "Unfinished quests can sail on to another island" : classes || "Nothing was planned",
      };
    default: {
      const title = state.quests.length ? `${questCount(state.quests.length)} on this island` : "Open water";
      const line = [classes, state.quests.length ? progress : "Drop quests here from the harbour"].filter(Boolean).join(" · ");
      return { eyebrow: `${name}${state.isToday ? " · today" : ""}`, title, line };
    }
  }
}

// ---------- Load ----------
export function plannedMinutes(tasks: Task[]): number {
  return tasks
    .filter((t) => !isExam(t) && t.status !== "completed")
    .reduce((sum, t) => sum + (t.estimate_minutes ?? DEFAULT_ESTIMATE), 0);
}

export function loadMessage(loadMinutes: number, capacityMinutes: number): { text: string; tone: "calm" | "full" | "rough" } {
  if (loadMinutes === 0) return { text: `Nothing planned yet · ${minutesLabel(capacityMinutes)} of room`, tone: "calm" };
  if (loadMinutes > capacityMinutes) {
    return { text: `${minutesLabel(loadMinutes - capacityMinutes)} over your ${minutesLabel(capacityMinutes)} · rough seas`, tone: "rough" };
  }
  const left = capacityMinutes - loadMinutes;
  if (left === 0) return { text: `${minutesLabel(loadMinutes)} planned · a full sail`, tone: "full" };
  return { text: `${minutesLabel(loadMinutes)} of ${minutesLabel(capacityMinutes)} planned · calm seas`, tone: "calm" };
}

// ---------- Bosses ----------
export const GUARDIANS: Record<Guardian, { name: string; short: string }> = {
  kraken: { name: "The Kraken", short: "Kraken" },
  dragon: { name: "The Ember Dragon", short: "Dragon" },
  golem: { name: "The Stone Golem", short: "Stone golem" },
};

export const guardianName = (g: Guardian | null) => GUARDIANS[g ?? "kraken"].name;

export function bossStatus(boss: Boss): string {
  if (boss.defeated) return "Defeated";
  if (boss.health === boss.max_health) return "Full health";
  return `${boss.health} of ${boss.max_health} health`;
}

export function strikesLanded(boss: Boss): number {
  return boss.max_health - boss.health;
}

/** Open exams first by date, then defeated or past ones */
export function sortBosses(bosses: Boss[], now = new Date()): Boss[] {
  const live = (b: Boss) => !b.defeated && b.exam.status !== "completed" && new Date(b.exam.due_date) >= now;
  return [...bosses].sort((a, b) => Number(live(b)) - Number(live(a)) || a.exam.due_date.localeCompare(b.exam.due_date));
}

// ---------- Treasure ----------
export interface Treasure {
  chests: number;
  bossesDefeated: number;
  focusMinutes: number;
  chartedThisWeek: number;
  weeksCharted: number;
}

export const chestOpened = (d: DayRecord) => d.planned > 0 && d.done === d.planned;

export function treasure(history: DayRecord[], bosses: Boss[], weekStart: string, today: string): Treasure {
  const weekEnd = addDays(weekStart, 6);
  const weeks = new Set<number>();
  for (const d of history) {
    if (d.planned > 0) weeks.add(Math.floor(daysBetween(history[0]?.date ?? d.date, d.date) / 7));
  }
  return {
    chests: history.filter((d) => d.date <= today && chestOpened(d)).length,
    bossesDefeated: bosses.filter((b) => b.defeated).length,
    focusMinutes: history.reduce((sum, d) => sum + d.focus_minutes, 0),
    chartedThisWeek: history.filter((d) => d.date >= weekStart && d.date <= weekEnd && d.planned > 0).length,
    weeksCharted: weeks.size,
  };
}

export function hoursLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 6) / 10}h`.replace(".0h", "h");
}

// ---------- Onboarding rhythm ----------
export interface Rhythm {
  courses: number;
  focusHours: number;
  studyDays: number;
  rest: "Fri" | "Sat" | "Sun" | "None";
  cutoff: string;
  aGrades: number;
}

/** The monk's word on the week the member is setting up */
export function rhythmAdvice(r: Rhythm): { line: string; advice: string; total: number } {
  const classHours = r.courses * 3.5;
  const total = Math.round(classHours + r.focusHours);
  const line = `About ${total} h a week: ${classHours} in class, ${r.focusHours} in focus.`;
  let advice: string;
  if (r.focusHours === 0) advice = "No focus time at all? Even ten minutes a day keeps the sail full.";
  else if (r.studyDays === 7 && r.rest !== "None") advice = `You plan to study every day, yet rest on ${r.rest}. Choose one; the sea will not decide for you.`;
  else if (total > 45) advice = `${total} hours a week is a rough sea. Lower the focus hours, or keep a rest day.`;
  else if (r.aGrades >= 2 && r.focusHours < r.aGrades * 4) advice = `${r.aGrades} A grades usually need about ${r.aGrades * 4} h of focus a week. You have ${r.focusHours}. Raise the sail, or lower a target.`;
  else if (r.rest === "None") advice = "Even the tide rests. Keep one day free?";
  else if (r.cutoff === "None") advice = "No hour to lay down the oars? Tired sailors steer poorly. Pick one if you can.";
  else advice = `A steady rhythm. About ${total} hours a week. This sea is calm.`;
  return { line, advice, total };
}

/** Daily study capacity from weekly focus hours spread over study days */
export function dailyCapacity(focusHours: number, studyDays: number): number {
  if (studyDays <= 0) return 180;
  return Math.min(1440, Math.max(15, Math.round((focusHours * 60) / studyDays / 15) * 15));
}

/** When an exam in a given term week falls: that week's Friday at 09:00, never in the past */
export function examDay(termStart: string, week: number, today: string): string {
  let day = addDays(termStart, (week - 1) * 7 + 4);
  while (day <= today) day = addDays(day, 7);
  return day;
}

// ---------- Small helpers ----------
export function taskMeta(t: Task): string {
  const kind = t.kind === "task" ? "" : t.kind === "study" ? "Study session" : t.kind[0].toUpperCase() + t.kind.slice(1);
  return [kind, t.course].filter(Boolean).join(" · ");
}

export function dueLabel(t: Task, today: string): string {
  const day = localDay(t.due_date);
  const diff = daysBetween(today, day);
  if (diff === 0) return "due today";
  if (diff === 1) return "due tomorrow";
  if (diff < 0) return `${-diff} ${diff === -1 ? "day" : "days"} overdue`;
  if (diff < 7) return `due ${shortWeekday(day)}`;
  return `due ${dayNumber(day)}/${day.slice(5, 7)}`;
}
