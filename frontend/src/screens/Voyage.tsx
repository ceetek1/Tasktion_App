import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { useRef } from "react";
import { Chest } from "../art/Art";
import { GearIcon, PlusIcon, RecentreIcon } from "../components/Icons";
import { HarbourItem, QuestRow, courseColours } from "../components/Quest";
import { termLine } from "../components/Shell";
import { useToast } from "../components/Toast";
import VoyageMap from "../components/VoyageMap";
import { addDays, mondayOf, rangeLabel, weekdayName, dayNumber } from "../lib/dates";
import { useCourses, useTaskActions, useTerm, useToday, useWeek } from "../lib/queries";
import type { DayPlan, Task } from "../lib/types";
import { useStored, useWide } from "../lib/useWide";
import { dayState, dueLabel, islandCard, loadMessage, plannedMinutes, taskMeta, type DayState } from "../lib/voyage";

/** Everything the voyage screens share: the week, each island's state, and placing quests */
export function useVoyage() {
  const today = useToday();
  const todayDate = today.data?.date;
  const [offset, setOffset] = useState(0);
  const weekStart = todayDate ? addDays(mondayOf(todayDate), offset * 7) : undefined;
  const week = useWeek(weekStart);
  const courses = useCourses();
  const [charted, setCharted] = useStored<string[]>("tasktion.charted", []);
  const lifted = useMemo(() => new Set(charted), [charted]);
  const states: DayState[] = useMemo(
    () => (week.data && todayDate ? week.data.days.map((d) => dayState(d, todayDate, lifted)) : []),
    [week.data, todayDate, lifted],
  );
  const colours = useMemo(() => courseColours(courses.data), [courses.data]);
  const actions = useTaskActions();
  const toast = useToast();
  const [picked, setPicked] = useState<number | null>(null);

  const place = async (taskId: number, day: string) => {
    if (todayDate && day < todayDate) {
      toast("That island is behind you. Pick today or a day ahead.");
      return;
    }
    const task = week.data?.unplanned.find((t) => t.id === taskId) ?? week.data?.days.flatMap((d) => d.tasks).find((t) => t.id === taskId);
    setPicked(null);
    try {
      await actions.plan(taskId, day);
      toast(`${task?.title ?? "Quest"} sails to ${weekdayName(day)} ${dayNumber(day)}`);
    } catch (e) {
      toast(`Couldn't move it: ${(e as Error).message}`);
    }
  };

  const chart = (day: string) => {
    if (!lifted.has(day)) setCharted([...charted, day]);
  };

  // Exams are events on their day, not quests waiting to be placed
  const harbour = useMemo(() => (week.data?.unplanned ?? []).filter((t) => t.kind !== "exam"), [week.data]);

  return { harbour, today, todayDate, week, weekStart, offset, setOffset, states, colours, courses, actions, picked, setPicked, place, chart, toast };
}

export type Voyage = ReturnType<typeof useVoyage>;

function useDnd(v: Voyage) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const [dragging, setDragging] = useState<Task | null>(null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const task = e.active.data.current?.task as Task | undefined;
    const day = e.over?.data.current?.day as string | undefined;
    if (task && day) v.place(task.id, day);
  };
  return { sensors, dragging, setDragging, onDragEnd };
}

function WeekHeader({ v, compact }: { v: Voyage; compact?: boolean }) {
  const term = useTerm();
  const days = v.week.data?.days ?? [];
  const charted = v.states.filter((s) => s.kind !== "fog").length;
  const cleared = v.states.filter((s) => s.kind === "cleared").length;
  return (
    <div>
      {compact && <span className="eyebrow quiet">{termLine(term.data)}</span>}
      <h1 className="title-xl">The Voyage</h1>
      <p className="muted small" style={{ margin: "4px 0 0" }}>
        {days.length ? rangeLabel(days[0].date, days[6].date) : "…"} · {charted} of 7 days charted
        {!compact && ` · ${cleared} ${cleared === 1 ? "chest" : "chests"} opened`}
      </p>
    </div>
  );
}

function WeekSwitch({ v }: { v: Voyage }) {
  return (
    <div className="row" role="group" aria-label="Week">
      <button type="button" className="btn btn-small" onClick={() => v.setOffset(v.offset - 1)}>Previous week</button>
      {v.offset !== 0 && <button type="button" className="btn btn-small" onClick={() => v.setOffset(0)}>This week</button>}
      <button type="button" className="btn btn-small" onClick={() => v.setOffset(v.offset + 1)}>Next week</button>
    </div>
  );
}

/** The selected island's details and quests (desktop side panel) */
function IslandPanel({ v, day, state }: { v: Voyage; day: DayPlan; state: DayState }) {
  const navigate = useNavigate();
  const card = islandCard(day, state);
  const { setNodeRef, isOver } = useDroppable({ id: "panel", data: { day: day.date } });
  const pickedTask = v.harbour.find((t) => t.id === v.picked);
  const load = loadMessage(plannedMinutes(day.tasks), day.capacity_minutes);
  const allDone = state.quests.length > 0 && state.done === state.quests.length;
  const past = v.todayDate !== undefined && day.date < v.todayDate;
  return (
    <aside ref={setNodeRef} aria-label="Selected island" className="card island-panel" data-over={isOver || undefined} aria-live="polite">
      <span className="eyebrow">{card.eyebrow}</span>
      <h2 className="title-l">{card.title}</h2>
      <div className={`chest-line${allDone ? " open" : ""}`}>
        <Chest open={allDone} size={44} />
        <span className="small">{allDone ? `${weekdayName(day.date)} joins your treasure hold` : state.quests.length ? `Finish every quest here to open the chest (${state.done} of ${state.quests.length})` : "No quests yet, so the chest stays locked"}</span>
      </div>
      {!past && state.quests.length > 0 && <span className={`load ${load.tone}`}>{load.text}</span>}

      {state.kind === "fog" && (
        <>
          <p className="empty">Hidden in fog. Drop a quest here, or chart the day to lift the fog.</p>
          <button type="button" className="btn btn-moss" style={{ alignSelf: "flex-start" }} onClick={() => v.chart(day.date)}>Chart this day</button>
        </>
      )}
      {pickedTask && !past && (
        <button type="button" className="place-btn" onClick={() => v.place(pickedTask.id, day.date)}>
          Place “{pickedTask.title}” here
        </button>
      )}

      {day.classes.length > 0 && (
        <>
          <h3 className="section-h">Classes</h3>
          <ul className="list">
            {day.classes.map((c) => (
              <li key={c.id} className="class-row" style={{ background: `${c.colour}33` }}>
                <strong style={{ fontVariantNumeric: "tabular-nums" }}>{c.starts_at}</strong>
                <span>{c.course}{c.place ? ` · ${c.place}` : ""}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {state.quests.length > 0 && (
        <>
          <h3 className="section-h">Quests</h3>
          <ul className="list">
            {state.quests.map((t) => (
              <QuestRow
                key={t.id}
                task={t}
                colours={v.colours}
                onToggle={() => v.actions.toggleDone(t)}
                onFocus={() => navigate(`/focus?task=${t.id}`)}
                onUnplan={() => v.actions.plan(t.id, null)}
              />
            ))}
          </ul>
        </>
      )}
      {state.quests.length === 0 && state.kind !== "fog" && !past && (
        <p className="empty">Open water. Nothing planned yet. Drag a quest here from the harbour.</p>
      )}
      {state.exams.length > 0 && (
        <button type="button" className="btn btn-red" style={{ alignSelf: "flex-start" }} onClick={() => navigate(`/bosses?exam=${state.exams[0].id}`)}>
          Face the boss: {state.exams[0].title}
        </button>
      )}
      {!past && (
        <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => navigate(`/new?day=${day.date}`)}>
          <PlusIcon /> New quest on this island
        </button>
      )}
    </aside>
  );
}

function Harbour({ v }: { v: Voyage }) {
  const unplanned = v.harbour;
  const today = v.todayDate ?? "";
  return (
    <aside aria-label="Harbour of unplanned quests" className="panel-sea harbour">
      <h2 className="map-h">Harbour · {unplanned.length}</h2>
      <p className="small" style={{ margin: 0, color: "var(--line)" }}>
        {v.picked ? "Now pick an island on the map, or press the quest again to put it down." : "Drag a quest onto an island, or press it and then pick an island."}
      </p>
      {unplanned.map((t) => (
        <HarbourItem
          key={t.id}
          task={t}
          colours={v.colours}
          meta={[taskMeta(t), dueLabel(t, today)].filter(Boolean).join(" · ")}
          picked={v.picked === t.id}
          onPick={() => v.setPicked(v.picked === t.id ? null : t.id)}
        />
      ))}
      {unplanned.length === 0 && <p className="empty">The harbour is empty. Every quest has an island.</p>}
    </aside>
  );
}

function DesktopVoyage({ v }: { v: Voyage }) {
  const [selected, setSelected] = useState<string | null>(null);
  const dnd = useDnd(v);
  const days = v.week.data?.days ?? [];
  const sel = selected && days.some((d) => d.date === selected) ? selected : (days.find((d) => d.date === v.todayDate)?.date ?? days[0]?.date);
  const i = days.findIndex((d) => d.date === sel);

  const onIsland = (day: string) => {
    if (v.picked) v.place(v.picked, day);
    setSelected(day);
  };

  return (
    <DndContext
      sensors={dnd.sensors}
      onDragStart={(e) => dnd.setDragging((e.active.data.current?.task as Task) ?? null)}
      onDragCancel={() => dnd.setDragging(null)}
      onDragEnd={dnd.onDragEnd}
    >
      <div className="voyage">
        <Harbour v={v} />
        <section className="map-main" aria-label="Map of the week">
          <div className="split">
            <WeekHeader v={v} />
            <WeekSwitch v={v} />
          </div>
          {days.length > 0 && (
            <VoyageMap variant="desktop" days={days} states={v.states} selected={sel ?? ""} armed={v.picked !== null} onIsland={onIsland} />
          )}
          <span className="small muted">Click an island to open it · drop quests onto islands</span>
        </section>
        {i >= 0 && v.states[i] && <IslandPanel v={v} day={days[i]} state={v.states[i]} />}
      </div>
      <DragOverlay>
        {dnd.dragging && (
          <div className="pick drag-ghost" style={{ width: 260 }}>
            <span className="quest-title">{dnd.dragging.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function PhoneVoyage({ v }: { v: Voyage }) {
  const navigate = useNavigate();
  const zoom = useRef<ReactZoomPanPinchRef>(null);
  const days = v.week.data?.days ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected && days.some((d) => d.date === selected) ? selected : (days.find((d) => d.date === v.todayDate)?.date ?? days[0]?.date);
  const i = days.findIndex((d) => d.date === sel);
  const day = days[i];
  const state = v.states[i];
  const card = day && state ? islandCard(day, state) : null;
  const unplanned = v.harbour.length;

  return (
    <>
      <header className="phone-head">
        <WeekHeader v={v} compact />
        <div className="row" style={{ flexWrap: "nowrap", paddingTop: 6 }}>
          <button type="button" className="btn btn-round light" aria-label="Recentre the map on today" onClick={() => { zoom.current?.resetTransform(); setSelected(null); }}>
            <RecentreIcon />
          </button>
          <Link to="/settings" className="btn btn-round light" aria-label="Settings"><GearIcon /></Link>
          <Link to={`/new${sel ? `?day=${sel}` : ""}`} className="btn btn-round btn-moss" aria-label="Add a quest"><PlusIcon /></Link>
        </div>
      </header>
      {days.length > 0 && (
        <div className="phone-map">
          <TransformWrapper ref={zoom} minScale={1} maxScale={2.5} doubleClick={{ disabled: true }} wheel={{ step: 0.15 }}>
            <TransformComponent>
              <VoyageMap variant="phone" days={days} states={v.states} selected={sel ?? ""} armed={false} onIsland={setSelected} />
            </TransformComponent>
          </TransformWrapper>
        </div>
      )}
      {card && day && state && (
        <section className="card sheet stack" aria-live="polite" aria-label="Selected island">
          <span className="eyebrow">{card.eyebrow}</span>
          <h2 className="title-m">{card.title}</h2>
          <p className="small muted" style={{ margin: 0 }}>{card.line}{state.isToday && unplanned ? ` · ${unplanned} waiting in the harbour` : ""}</p>
          <div className="row">
            {state.kind === "fog" ? (
              <button type="button" className="btn btn-moss btn-small" onClick={() => { v.chart(day.date); navigate(`/day/${day.date}`); }}>Chart this day</button>
            ) : (
              <Link className={`btn btn-small ${state.kind === "boss" ? "" : "btn-moss"}`} to={`/day/${day.date}`}>Open island</Link>
            )}
            {state.kind === "boss" && state.exams[0] && (
              <Link className="btn btn-red btn-small" to={`/bosses?exam=${state.exams[0].id}`}>Face the boss</Link>
            )}
            {state.kind === "cleared" && <Link className="btn btn-gold btn-small" to="/treasure">See the treasure</Link>}
          </div>
        </section>
      )}
      <WeekSwitch v={v} />
    </>
  );
}

export default function VoyageScreen() {
  const wide = useWide();
  const v = useVoyage();
  if (v.today.isError || v.week.isError) return <p className="notice" role="alert">Couldn't load the voyage: {(v.today.error ?? v.week.error)?.message}</p>;
  if (!v.week.data) return <p className="muted" role="status">Unrolling the map…</p>;
  return wide ? <DesktopVoyage v={v} /> : <PhoneVoyage v={v} />;
}
