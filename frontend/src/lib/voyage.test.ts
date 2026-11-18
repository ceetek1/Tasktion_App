import { describe, expect, it } from "vitest";
import { addDays, mondayOf, rangeLabel, weekday } from "./dates";
import type { Boss, DayPlan, DayRecord, Task } from "./types";
import {
  bossStatus,
  dailyCapacity,
  dayState,
  examDay,
  islandCard,
  islandLayout,
  loadMessage,
  mapSize,
  plannedMinutes,
  rhythmAdvice,
  sortBosses,
  strikesLanded,
  trailPath,
  treasure,
} from "./voyage";

let nextId = 1;
function task(fields: Partial<Task> = {}): Task {
  return {
    id: nextId++, title: "Quest", description: null, due_date: "2026-11-20T12:00:00Z", status: "pending",
    user_id: 1, assigned_to: null, course_id: null, course: null, kind: "task", planned_for: null,
    estimate_minutes: null, completed_at: null, guardian: null, boss_task_id: null, ...fields,
  };
}

function day(date: string, fields: Partial<DayPlan> = {}): DayPlan {
  return { date, tasks: [], due: [], classes: [], load_minutes: 0, capacity_minutes: 180, over_capacity: false, ...fields };
}

function boss(health: number, fields: Partial<Boss> = {}): Boss {
  return { exam: task({ kind: "exam" }), guardian: "kraken", health, max_health: 5, defeated: health === 0, revision: [], ...fields };
}

const TODAY = "2026-11-18"; // a Wednesday

describe("dates", () => {
  it("finds the Monday of a week and counts weekdays from Monday", () => {
    expect(mondayOf(TODAY)).toBe("2026-11-16");
    expect(weekday("2026-11-16")).toBe(0);
    expect(weekday("2026-11-22")).toBe(6);
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(rangeLabel("2026-11-16", "2026-11-22")).toBe("16–22 Nov");
    expect(rangeLabel("2026-11-30", "2026-12-06")).toBe("30 Nov – 6 Dec");
  });
});

describe("map layout", () => {
  for (const variant of ["phone", "desktop"] as const) {
    it(`puts seven islands inside the ${variant} map, alternating shapes`, () => {
      const spots = islandLayout(variant);
      const { width, height } = mapSize(variant);
      expect(spots).toHaveLength(7);
      for (const s of spots) {
        expect(s.x).toBeGreaterThan(40);
        expect(s.x).toBeLessThan(width - 40);
        expect(s.y).toBeGreaterThan(30);
        expect(s.y).toBeLessThan(height - 30);
      }
      expect(spots.map((s) => s.shape).slice(0, 3)).toEqual(["isle", "peak", "isle"]);
    });
  }

  it("keeps islands far enough apart to tap", () => {
    for (const variant of ["phone", "desktop"] as const) {
      const spots = islandLayout(variant);
      for (let i = 0; i < spots.length; i++)
        for (let j = i + 1; j < spots.length; j++)
          expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThanOrEqual(84);
    }
  });

  it("draws the trail through every island", () => {
    const spots = islandLayout("phone");
    const path = trailPath(spots);
    expect(path.startsWith("M82,58")).toBe(true);
    expect(path.match(/C/g)).toHaveLength(6);
    expect(path.endsWith("126,430")).toBe(true);
  });
});

describe("day islands", () => {
  it("opens the chest when every quest on a past or current day is done", () => {
    const done = task({ status: "completed" });
    expect(dayState(day("2026-11-17", { tasks: [done] }), TODAY).kind).toBe("cleared");
    expect(dayState(day(TODAY, { tasks: [done, task()] }), TODAY).kind).toBe("today");
    expect(dayState(day("2026-11-19", { tasks: [done] }), TODAY).kind).toBe("open");
  });

  it("marks exam days as bosses and leaves empty future days in fog until charted", () => {
    const exam = task({ kind: "exam", guardian: "dragon", title: "Chem final" });
    expect(dayState(day("2026-11-20", { due: [exam] }), TODAY).kind).toBe("boss");
    expect(dayState(day("2026-11-21"), TODAY).kind).toBe("fog");
    expect(dayState(day("2026-11-21"), TODAY, new Set(["2026-11-21"])).kind).toBe("open");
    expect(dayState(day("2026-11-21", { classes: [{ id: 1, course_id: 1, weekday: 5, starts_at: "09:00", ends_at: "10:00", place: null, course: "LA", colour: "#5F8A8B" }] }), TODAY).kind).toBe("open");
    expect(dayState(day("2026-11-16"), TODAY).kind).toBe("past");
  });

  it("writes island cards in voyage words", () => {
    const exam = task({ kind: "exam", guardian: "dragon", title: "Chem final" });
    const d = day("2026-11-20", { due: [exam] });
    expect(islandCard(d, dayState(d, TODAY))).toEqual({
      eyebrow: "Friday 20 · exam day",
      title: "The Ember Dragon guards this reef",
      line: "Chem final",
    });
    const today = day(TODAY, { tasks: [task(), task({ status: "completed" })] });
    expect(islandCard(today, dayState(today, TODAY)).title).toBe("2 quests on this island");
  });
});

describe("load messages", () => {
  it("counts open, non-exam quests with 45 minutes for unestimated ones", () => {
    expect(plannedMinutes([task({ estimate_minutes: 60 }), task(), task({ kind: "exam" }), task({ status: "completed" })])).toBe(105);
  });

  it("says how the day sits against capacity", () => {
    expect(loadMessage(0, 180)).toEqual({ text: "Nothing planned yet · 3 h of room", tone: "calm" });
    expect(loadMessage(90, 180)).toEqual({ text: "1 h 30 min of 3 h planned · calm seas", tone: "calm" });
    expect(loadMessage(180, 180).tone).toBe("full");
    expect(loadMessage(225, 180)).toEqual({ text: "45 min over your 3 h · rough seas", tone: "rough" });
  });
});

describe("bosses", () => {
  it("describes health and strikes", () => {
    expect(bossStatus(boss(5))).toBe("Full health");
    expect(bossStatus(boss(2))).toBe("2 of 5 health");
    expect(bossStatus(boss(0))).toBe("Defeated");
    expect(strikesLanded(boss(2))).toBe(3);
  });

  it("puts live exams first, soonest first", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    const later = boss(5, { exam: task({ kind: "exam", due_date: "2026-12-03T10:00:00Z" }) });
    const soon = boss(3, { exam: task({ kind: "exam", due_date: "2026-11-20T09:00:00Z" }) });
    const beaten = boss(0, { exam: task({ kind: "exam", due_date: "2026-11-19T09:00:00Z" }) });
    expect(sortBosses([later, beaten, soon], now)).toEqual([soon, later, beaten]);
  });
});

describe("treasure", () => {
  const rec = (date: string, planned: number, done: number, focus = 0): DayRecord => ({ date, planned, done, completed: done, focus_minutes: focus });

  it("counts chests, defeated bosses, focus and charted days from real history", () => {
    const history = [
      rec("2026-11-02", 2, 2, 50), rec("2026-11-09", 1, 0, 25),
      rec("2026-11-16", 3, 3), rec("2026-11-17", 2, 1, 30), rec("2026-11-18", 1, 1), rec("2026-11-20", 2, 0),
    ];
    expect(treasure(history, [boss(0), boss(3)], "2026-11-16", TODAY)).toEqual({
      chests: 3,
      bossesDefeated: 1,
      focusMinutes: 105,
      chartedThisWeek: 4,
      weeksCharted: 3,
    });
  });
});

describe("onboarding rhythm", () => {
  const base = { courses: 4, focusHours: 8, studyDays: 5, rest: "Sun" as const, cutoff: "22:00", aGrades: 0 };

  it("adds up the week and calls a calm sea calm", () => {
    expect(rhythmAdvice(base)).toEqual({
      line: "About 22 h a week: 14 in class, 8 in focus.",
      advice: "A steady rhythm. About 22 hours a week. This sea is calm.",
      total: 22,
    });
  });

  it("warns about overload, too many A grades and missing rest", () => {
    expect(rhythmAdvice({ ...base, focusHours: 0 }).advice).toMatch(/No focus time/);
    expect(rhythmAdvice({ ...base, studyDays: 7 }).advice).toMatch(/rest on Sun/);
    expect(rhythmAdvice({ ...base, courses: 5, focusHours: 30 }).advice).toMatch(/rough sea/);
    expect(rhythmAdvice({ ...base, aGrades: 3 }).advice).toMatch(/3 A grades usually need about 12 h/);
    expect(rhythmAdvice({ ...base, rest: "None" }).advice).toMatch(/tide rests/);
  });

  it("turns weekly focus into a daily capacity in quarter hours", () => {
    expect(dailyCapacity(8, 5)).toBe(90);
    expect(dailyCapacity(15, 5)).toBe(180);
    expect(dailyCapacity(0, 5)).toBe(15);
  });

  it("places an exam on the Friday of its term week, never in the past", () => {
    expect(examDay("2026-09-07", 12, TODAY)).toBe("2026-11-27");
    expect(examDay("2026-09-07", 1, TODAY)).toBe("2026-11-20");
  });
});
