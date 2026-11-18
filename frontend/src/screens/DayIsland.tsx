import { DndContext, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Chest } from "../art/Art";
import { BackIcon, PagodaIcon, PlusIcon } from "../components/Icons";
import { HarbourItem, QuestRow } from "../components/Quest";
import { addDays, dayNumber, daysBetween, mondayOf, weekdayName } from "../lib/dates";
import { useWide } from "../lib/useWide";
import { dueLabel, loadMessage, plannedMinutes, taskMeta } from "../lib/voyage";
import type { Task } from "../lib/types";
import { useVoyage } from "./Voyage";

function DropZone({ day, label, armed, onPlace }: { day: string; label: string; armed: boolean; onPlace: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day}`, data: { day } });
  return (
    <button ref={setNodeRef} type="button" className={`drop-zone${armed ? " armed" : ""}`} data-over={isOver || undefined} onClick={onPlace}>
      {label}
    </button>
  );
}

export default function DayIsland() {
  const { date = "" } = useParams();
  const wide = useWide();
  const navigate = useNavigate();
  const v = useVoyage();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  // Show the week this day belongs to
  const todayDate = v.todayDate;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const wantOffset = todayDate && valid ? Math.round(daysBetween(mondayOf(todayDate), mondayOf(date)) / 7) : null;
  const { offset, setOffset } = v;
  useEffect(() => {
    if (wantOffset !== null && wantOffset !== offset) setOffset(wantOffset);
  }, [wantOffset, offset, setOffset]);
  if (wide) return <Navigate to="/" replace />;
  if (!valid) return <Navigate to="/" replace />;

  const index = v.week.data?.days.findIndex((d) => d.date === date) ?? -1;
  const day = index >= 0 ? v.week.data!.days[index] : undefined;
  const state = index >= 0 ? v.states[index] : undefined;
  if (!day || !state) return <p className="muted" role="status">Rowing to the island…</p>;

  const past = todayDate !== undefined && date < todayDate;
  const picked = v.harbour.find((t) => t.id === v.picked);
  const allDone = state.quests.length > 0 && state.done === state.quests.length;
  const load = loadMessage(plannedMinutes(day.tasks), day.capacity_minutes);
  const unplanned = v.harbour;

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={(e) => {
        const task = e.active.data.current?.task as Task | undefined;
        if (task && e.over) v.place(task.id, date);
      }}
    >
      <header className="phone-head" style={{ alignItems: "center" }}>
        <Link to="/" className="back"><BackIcon />Voyage</Link>
        <div style={{ textAlign: "center" }}>
          <span className="eyebrow">{state.isToday ? "Today's island" : past ? "Behind you" : "An island ahead"}</span>
          <h1 className="title-l">{weekdayName(date)} {dayNumber(date)}</h1>
        </div>
        {past ? <span style={{ width: 44 }} /> : (
          <Link to={`/new?day=${date}`} className="btn btn-round btn-moss" aria-label={`Add a quest to ${weekdayName(date)}`}><PlusIcon /></Link>
        )}
      </header>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link className="btn btn-small" to={`/day/${addDays(date, -1)}`} aria-label="Previous day">← {weekdayName(addDays(date, -1)).slice(0, 3)}</Link>
        {!past && <span className={`load ${load.tone}`} style={{ alignSelf: "center" }}>{load.text}</span>}
        <Link className="btn btn-small" to={`/day/${addDays(date, 1)}`} aria-label="Next day">{weekdayName(addDays(date, 1)).slice(0, 3)} →</Link>
      </div>

      <section aria-label="The day's route" className="stack">
        <div className="split">
          <h2 className="map-h">The day's route</h2>
          <span className="tiny muted">{state.done} of {state.quests.length} quests done</span>
        </div>
        <ol className="route">
          {day.classes.map((c) => (
            <li key={`c${c.id}`}>
              <span className="time">{c.starts_at}</span>
              <span className="pin" aria-hidden="true" />
              <div className="class-row" style={{ background: `${c.colour}33`, minHeight: 52 }}>
                <PagodaIcon />
                <span className="quest-text">
                  <span className="quest-title">{c.course}</span>
                  <span className="quest-meta">{[c.place, `until ${c.ends_at}`].filter(Boolean).join(" · ")}</span>
                </span>
              </div>
            </li>
          ))}
          {state.quests.map((t) => (
            <li key={`q${t.id}`}>
              <span className="time">{t.estimate_minutes ? `${t.estimate_minutes}′` : ""}</span>
              <span className={`pin${t.status === "completed" ? " done" : ""}`} aria-hidden="true" />
              <ul className="list">
                <QuestRow task={t} colours={v.colours} onToggle={() => v.actions.toggleDone(t)} onFocus={() => navigate(`/focus?task=${t.id}`)} onUnplan={() => v.actions.plan(t.id, null)} />
              </ul>
            </li>
          ))}
          {!past && (
            <li>
              <span className="time" />
              <span className="pin" aria-hidden="true" />
              <DropZone
                day={date}
                armed={!!picked}
                label={picked ? `Place “${picked.title}” here` : "Open water · drop a quest here"}
                onPlace={() => picked && v.place(picked.id, date)}
              />
            </li>
          )}
        </ol>
        {past && state.quests.length === 0 && <p className="empty">Nothing was planned on this island.</p>}
      </section>

      <div className={`chest-line${allDone ? " open" : ""}`} aria-live="polite">
        <Chest open={allDone} />
        <span className="stack" style={{ gap: 0 }}>
          <span className="title-m" style={{ fontSize: 20 }}>{allDone ? "Chest opened · day cleared" : "Chest locked"}</span>
          <span className="tiny">{allDone ? `${weekdayName(date)} joins your treasure hold` : "Finish every quest on this island to open it"}</span>
        </span>
      </div>

      {state.exams.length > 0 && (
        <Link className="btn btn-red" to={`/bosses?exam=${state.exams[0].id}`}>Face the boss: {state.exams[0].title}</Link>
      )}

      {!past && (
        <section aria-label="Harbour of unplanned quests" className="dock">
          <div className="split">
            <h2 className="map-h" style={{ fontSize: 18 }}>Harbour · {unplanned.length} unplanned</h2>
            <span className="tiny">Drag, or tap then tap the open water</span>
          </div>
          <div className="stack">
            {unplanned.map((t) => (
              <HarbourItem
                key={t.id}
                task={t}
                colours={v.colours}
                picked={v.picked === t.id}
                onPick={() => v.setPicked(v.picked === t.id ? null : t.id)}
                meta={[taskMeta(t), dueLabel(t, todayDate ?? "")].filter(Boolean).join(" · ")}
              />
            ))}
            {unplanned.length === 0 && <p className="empty">The harbour is empty. Every quest has a place on the map.</p>}
          </div>
        </section>
      )}
    </DndContext>
  );
}
