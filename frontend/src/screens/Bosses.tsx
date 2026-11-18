import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { BossScene } from "../art/Art";
import { Tick } from "../components/Icons";
import { useToast } from "../components/Toast";
import { whenLabel } from "../lib/dates";
import { useBosses, useTaskActions } from "../lib/queries";
import { bossStatus, guardianName, sortBosses, strikesLanded } from "../lib/voyage";

export default function Bosses() {
  const bosses = useBosses();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { toggleDone } = useTaskActions();
  const [struck, setStruck] = useState(false);

  useEffect(() => {
    if (!struck) return;
    const t = window.setTimeout(() => setStruck(false), 450);
    return () => window.clearTimeout(t);
  }, [struck]);

  if (bosses.isError) return <p className="notice" role="alert">Couldn't load the bosses: {bosses.error.message}</p>;
  if (!bosses.data) return <p className="muted" role="status">Scanning the horizon…</p>;
  const list = sortBosses(bosses.data);
  if (list.length === 0) {
    return (
      <section className="stack-l" aria-labelledby="b-h">
        <div>
          <span className="eyebrow">Boss battles</span>
          <h1 id="b-h" className="title-xl">No bosses yet</h1>
        </div>
        <p className="empty">Every exam becomes a boss with a guardian. Add an exam, then aim revision quests at it to wear it down before the day.</p>
        <Link className="btn btn-moss" style={{ alignSelf: "flex-start" }} to="/new?kind=exam">Add an exam</Link>
      </section>
    );
  }

  const chosen = list.find((b) => String(b.exam.id) === params.get("exam")) ?? list[0];
  const name = guardianName(chosen.guardian);
  const nextOpen = chosen.revision.find((t) => t.status !== "completed");

  async function strike(taskId: number) {
    const task = chosen.revision.find((t) => t.id === taskId);
    if (!task) return;
    const landing = task.status !== "completed";
    await toggleDone(task);
    if (landing) {
      setStruck(true);
      toast(chosen.health - 1 <= 0 ? `${name} is defeated!` : `Strike! ${name} reels.`);
    }
  }

  return (
    <div className="boss-layout">
      <section className="scene" aria-label="Battle">
        <div role="group" aria-label="Choose a boss" className="row">
          {list.map((b) => (
            <button key={b.exam.id} type="button" className="chip red" aria-pressed={b.exam.id === chosen.exam.id} onClick={() => setParams({ exam: String(b.exam.id) })}>
              {guardianName(b.guardian).replace("The ", "")} · {b.exam.title}
            </button>
          ))}
        </div>
        <BossScene
          guardian={chosen.guardian}
          struck={struck}
          beaten={chosen.defeated}
          label={`${name} guards ${chosen.exam.title}. ${bossStatus(chosen)}.`}
        />
      </section>

      <section className="details" aria-labelledby="boss-h">
        <div>
          <span className="eyebrow">Boss battle</span>
          <h1 id="boss-h" className="title-xl">{name}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>{chosen.exam.title}{chosen.exam.course ? ` · ${chosen.exam.course}` : ""} · {whenLabel(chosen.exam.due_date)}</p>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <div className="split">
            <span className="label">Health</span>
            <span className="small" style={{ fontWeight: 600, color: "var(--red)" }}>{bossStatus(chosen)}</span>
          </div>
          <div className="meter" role="meter" aria-label="Boss health" aria-valuemin={0} aria-valuemax={chosen.max_health} aria-valuenow={chosen.health}>
            {Array.from({ length: chosen.max_health }, (_, i) => <span key={i} className={i < chosen.health ? "on" : ""} />)}
          </div>
          <span className="tiny muted">{strikesLanded(chosen)} of {chosen.max_health} strikes landed</span>
        </div>

        <h2 className="map-h">Revision quests · each one is a strike</h2>
        <div className="stack">
          {chosen.revision.map((t) => {
            const done = t.status === "completed";
            return (
              <button key={t.id} type="button" className="strike" aria-pressed={done} onClick={() => strike(t.id)}>
                <span className="check-box" style={done ? { background: "var(--moss)" } : undefined}>{done && <Tick />}</span>
                <span className="quest-text">
                  <span className="quest-title" style={{ textDecoration: done ? "line-through" : undefined }}>{t.title}</span>
                  <span className="quest-meta">{t.planned_for ? `On the ${t.planned_for.slice(8)}/${t.planned_for.slice(5, 7)} island` : "In the harbour"}{done ? " · strike landed" : ""}</span>
                </span>
              </button>
            );
          })}
          {chosen.revision.length === 0 && <p className="empty">No revision quests aimed at this boss yet. Add one below.</p>}
        </div>
        <div className="row">
          {nextOpen && (
            <button type="button" className="btn btn-red" onClick={() => navigate(`/focus?task=${nextOpen.id}`)}>Strike with a focus session</button>
          )}
          <button type="button" className="btn" onClick={() => navigate(`/new?kind=revision&boss=${chosen.exam.id}`)}>Add a revision quest</button>
        </div>
      </section>
    </div>
  );
}
