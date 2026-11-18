import { Link } from "react-router";
import { Chest } from "../art/Art";
import { termLine } from "../components/Shell";
import { addDays, mondayOf, shortWeekday, dayNumber, whenLabel } from "../lib/dates";
import { useBosses, useHistory, useTerm, useToday, useWeek } from "../lib/queries";
import { bossStatus, chestOpened, guardianName, hoursLabel, sortBosses, treasure } from "../lib/voyage";

export default function Treasure() {
  const term = useTerm();
  const today = useToday();
  const history = useHistory();
  const bosses = useBosses();
  const todayDate = today.data?.date;
  const weekStart = todayDate ? mondayOf(todayDate) : undefined;
  const week = useWeek(weekStart);

  if (history.isError || bosses.isError) return <p className="notice" role="alert">Couldn't open the treasure hold.</p>;
  if (!history.data || !bosses.data || !todayDate || !weekStart) return <p className="muted" role="status">Counting the gold…</p>;

  const t = treasure(history.data.days, bosses.data, weekStart, todayDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const records = new Map(history.data.days.map((d) => [d.date, d]));
  const planned = new Map((week.data?.days ?? []).map((d) => [d.date, d.tasks.filter((x) => x.kind !== "exam")]));
  // History stops at today; the week's plan also knows the days ahead
  const chartedThisWeek = week.data ? [...planned.values()].filter((q) => q.length > 0).length : t.chartedThisWeek;

  return (
    <div className="stack-l">
      <div>
        <span className="eyebrow">{termLine(term.data)}</span>
        <h1 className="title-xl">Treasure hold</h1>
        {term.data?.weeks ? <p className="muted small" style={{ margin: "4px 0 0" }}>{t.weeksCharted} of {term.data.weeks} weeks charted · fog lifts as you plan</p> : null}
      </div>

      <section aria-label="This term so far" className="stats">
        <div className="stat"><div className="stat-n">{t.chests}</div><div className="small">chests opened</div></div>
        <div className="stat"><div className="stat-n">{t.bossesDefeated}</div><div className="small">bosses defeated</div></div>
        <div className="stat"><div className="stat-n">{hoursLabel(t.focusMinutes)}</div><div className="small">in focus</div></div>
        <div className="stat"><div className="stat-n">{chartedThisWeek}</div><div className="small">days charted this week</div></div>
      </section>

      <section aria-labelledby="tw-h" className="card stack">
        <h2 id="tw-h" className="map-h">This week's chests</h2>
        <ul className="chest-week">
          {weekDays.map((d) => {
            const rec = records.get(d);
            const quests = planned.get(d) ?? [];
            const done = quests.filter((q) => q.status === "completed").length;
            const open = rec ? chestOpened(rec) : quests.length > 0 && done === quests.length;
            const stateText = open ? "opened" : d > todayDate ? (quests.length ? "ahead" : "in fog") : quests.length ? `${done} of ${quests.length}` : "no quests";
            return (
              <li key={d}>
                <Chest open={open} size={40} />
                <span style={{ fontFamily: "var(--map)" }}>{shortWeekday(d)} {dayNumber(d)}</span>
                <span className="tiny muted">{stateText}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="tb-h" className="stack">
        <div className="split">
          <h2 id="tb-h" className="map-h">Bosses</h2>
          <Link to="/bosses" className="small">Open the battles</Link>
        </div>
        {sortBosses(bosses.data).map((b) => (
          <Link key={b.exam.id} to={`/bosses?exam=${b.exam.id}`} className="boss-row" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="quest-text">
              <span className="quest-title" style={{ textDecoration: b.defeated ? "line-through" : undefined }}>{guardianName(b.guardian)}</span>
              <span className="quest-meta">{b.exam.title} · {whenLabel(b.exam.due_date)}</span>
            </span>
            <span className="small" style={{ fontWeight: 600, color: b.defeated ? "var(--moss)" : "var(--red)" }}>{bossStatus(b)}</span>
          </Link>
        ))}
        {bosses.data.length === 0 && <p className="empty">No bosses yet. Exams you add appear here.</p>}
      </section>
    </div>
  );
}
