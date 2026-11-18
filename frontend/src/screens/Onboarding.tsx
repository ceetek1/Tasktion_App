import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Chest, GuardianBadge, Island, LINE, MonkBust, Ribbon, usePaper } from "../art/Art";
import { useToast } from "../components/Toast";
import { patch, post, put } from "../lib/api";
import { addDays, localInstant, mondayOf } from "../lib/dates";
import { refreshPlans, useCourses, useToday } from "../lib/queries";
import type { Course, Guardian } from "../lib/types";
import { GUARDIANS, dailyCapacity, examDay, rhythmAdvice, type Rhythm } from "../lib/voyage";

const PRESETS: [string, string][] = [["Linear Algebra", "Σ"], ["Organic Chemistry", "C"], ["Psychology", "Ψ"], ["World History", "H"], ["Microeconomics", "μ"], ["Data Structures", "D"]];
const TINTS = ["#5F8A8B", "#B98A2F", "#4F6B4A", "#8A4B2E", "#46706F"];
const SLOTS: [number, number][] = [[210, 300], [330, 190], [450, 300], [560, 190], [470, 404]];
const CHEST: [number, number] = [680, 110];
const TITLES = ["Name the voyage", "Choose your islands", "Place the guardians", "Fill the treasure chest", "Set your rhythm", "Your map is drawn"];
const BASE = [
  "Every term is a voyage. Name yours, and tell me how long the crossing is.",
  "Your courses are the islands you will pass. Choose them, and I will set them on the map.",
  "Exams are the guardians of the route. Drag one onto each course that ends in an exam.",
  "What treasure waits at journey's end? Drag only the goals you truly want into the chest.",
  "Now, how will you sail? Set the rhythm of your week, and I will tell you if the sea looks rough.",
  "Your map is drawn. The fog ahead lifts one week at a time. Shall we sail?",
];
const GRADES = ["A", "B", "C", "Pass"];
const MAX_COURSES = 5;

interface PickedCourse { name: string; glyph: string; existing?: Course }
interface Goal { id: string; type: "grade" | "exam" | "habit" | "balance"; text: string; course?: string; target?: string }

function DropIsland({ id, label, x, y, onClick }: { id: string; label: string; x: number; y: number; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { course: id.slice(7) } });
  return (
    <button ref={setNodeRef} type="button" className="isle-btn" aria-label={label} data-over={isOver || undefined} onClick={onClick}
      style={{ left: `${((x - 55) / 760) * 100}%`, top: `${((y - 50) / 520) * 100}%`, width: `${(110 / 760) * 100}%`, height: `${(100 / 520) * 100}%` }} />
  );
}

function ChestTarget({ count, onClick }: { count: number; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: "chest" });
  return (
    <button ref={setNodeRef} type="button" className="isle-btn" aria-label={`Treasure chest at journey's end, ${count} goals sealed`} data-over={isOver || undefined} onClick={onClick}
      style={{ left: `${((CHEST[0] - 60) / 760) * 100}%`, top: `${((CHEST[1] - 60) / 520) * 100}%`, width: `${(120 / 760) * 100}%`, height: `${(120 / 520) * 100}%` }} />
  );
}

function Draggable({ id, children, className, pressed, onClick, label }: { id: string; children: ReactNode; className: string; pressed?: boolean; onClick: () => void; label?: string }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id });
  return (
    <button ref={setNodeRef} type="button" className={className} aria-pressed={pressed} aria-label={label} onClick={onClick} style={{ opacity: isDragging ? 0.4 : 1, touchAction: "none" }} {...listeners}>
      {children}
    </button>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const today = useToday();
  const existing = useCourses();
  const { ids, defs } = usePaper();
  const todayDate = today.data?.date ?? new Date().toISOString().slice(0, 10);

  const [step, setStep] = useState(1);
  const [termName, setTermName] = useState("");
  const [weeks, setWeeks] = useState(14);
  const [start, setStart] = useState(mondayOf(todayDate));
  const [chosen, setChosen] = useState<PickedCourse[] | null>(null);
  const [draft, setDraft] = useState("");
  const [guard, setGuard] = useState<Record<string, { g: Guardian; week: number }>>({});
  const [pickedG, setPickedG] = useState<Guardian | null>(null);
  const [grade, setGrade] = useState<Record<string, string>>({});
  const [sealed, setSealed] = useState<Set<string>>(new Set());
  const [rhythm, setRhythm] = useState<Omit<Rhythm, "courses" | "aGrades">>({ focusHours: 8, studyDays: 5, rest: "Sun", cutoff: "22:00" });
  const [react, setReact] = useState("");
  const [busy, setBusy] = useState(false);

  // Courses already in the chart room start selected
  const courses: PickedCourse[] = chosen ?? (existing.data ?? []).slice(0, MAX_COURSES).map((c) => ({ name: c.name, glyph: c.glyph, existing: c }));
  const setCourses = (list: PickedCourse[]) => setChosen(list);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));
  const currentWeek = Math.max(1, Math.floor((Date.parse(todayDate) - Date.parse(start)) / (7 * 86_400_000)) + 1);

  const goals: Goal[] = useMemo(() => {
    const out: Goal[] = courses.map((c) => ({ id: `g:${c.name}`, type: "grade", course: c.name, target: grade[c.name] ?? "B", text: `${grade[c.name] ?? "B"}${(grade[c.name] ?? "B") === "Pass" ? " " : " in "}${c.name}` }));
    for (const c of courses) {
      const g = guard[c.name];
      if (g) out.push({ id: `x:${c.name}`, type: "exam", course: c.name, text: `Defeat ${GUARDIANS[g.g].name} · ${c.name} exam, week ${g.week}` });
    }
    return out;
  }, [courses, grade, guard]);
  const habits: Goal[] = [
    { id: "h:focus", type: "habit", text: `Focus ${rhythm.focusHours} h a week`, target: `${rhythm.focusHours} h` },
    { id: "h:days", type: "habit", text: `Study ${rhythm.studyDays} days a week`, target: String(rhythm.studyDays) },
    ...(rhythm.rest !== "None" ? [{ id: "b:rest", type: "balance" as const, text: `Rest on ${({ Fri: "Fridays", Sat: "Saturdays", Sun: "Sundays" } as Record<string, string>)[rhythm.rest]}` }] : []),
    ...(rhythm.cutoff !== "None" ? [{ id: "b:cut", type: "balance" as const, text: `Lay down the oars by ${rhythm.cutoff}` }] : []),
  ];
  const aGrades = courses.filter((c) => sealed.has(`g:${c.name}`) && (grade[c.name] ?? "B") === "A").length;
  const load = rhythmAdvice({ ...rhythm, courses: courses.length, aGrades });
  const sealCount = goals.filter((g) => sealed.has(g.id)).length + (step >= 5 ? habits.length : 0);
  const monk = step === 5 ? load.advice : react || BASE[step - 1];

  const say = (msg: string) => setReact(msg);
  const go = (n: number) => { setStep(n); setReact(""); };

  function toggleCourse(name: string, glyph: string) {
    const has = courses.some((c) => c.name === name);
    if (has) {
      setCourses(courses.filter((c) => c.name !== name));
      say(`${name} sinks below the waves. The map will not miss what you do not need.`);
    } else if (courses.length >= MAX_COURSES) {
      say("Five islands is plenty for one crossing. Let one go first.");
    } else {
      setCourses([...courses, { name, glyph }]);
      say(`${name} rises from the sea. A good island to visit often.`);
    }
  }

  function assign(course: string, g: Guardian | null) {
    if (!g) return say("Pick a guardian first, then choose the course it guards.");
    const week = guard[course]?.week ?? Math.max(currentWeek, weeks);
    setGuard({ ...guard, [course]: { g, week } });
    setPickedG(null);
    say(`${GUARDIANS[g].name} now guards ${course}. We will wear it down with revision, one strike at a time.`);
  }

  function seal(id: string) {
    const goal = goals.find((x) => x.id === id);
    if (!goal) return;
    const next = new Set(sealed);
    if (next.has(id)) {
      next.delete(id);
      say("Unsealed. A lighter chest is no shame.");
    } else {
      next.add(id);
      const as = courses.filter((c) => next.has(`g:${c.name}`) && (grade[c.name] ?? "B") === "A").length;
      say(as >= 3 ? `Sealed. ${as} A grades make a heavy chest. Keep it, if your weeks can carry it.` : `Sealed: ${goal.text}.`);
    }
    setSealed(next);
  }

  function onDragEnd(e: DragEndEvent) {
    const a = String(e.active.id);
    const over = e.over ? String(e.over.id) : "";
    if (a.startsWith("guardian:") && over.startsWith("course:")) assign(over.slice(7), a.slice(9) as Guardian);
    if (a.startsWith("goal:") && over === "chest" && !sealed.has(a.slice(5))) seal(a.slice(5));
  }

  async function setSail() {
    setBusy(true);
    try {
      const byName = new Map<string, number>();
      for (const [i, c] of courses.entries()) {
        const course = c.existing ?? (await post<Course>("/courses", { name: c.name, glyph: c.glyph, colour: TINTS[i % TINTS.length] }));
        byName.set(c.name, course.id);
      }
      const termStart = start;
      for (const c of courses) {
        const g = guard[c.name];
        if (!g) continue;
        const day = examDay(termStart, g.week, todayDate);
        await post("/tasks", { title: `${c.name} exam`, kind: "exam", guardian: g.g, course_id: byName.get(c.name), due_date: localInstant(day, "09:00") });
      }
      for (const goal of [...goals.filter((g) => sealed.has(g.id)), ...habits]) {
        await post("/goals", { type: goal.type, text: goal.text, target: goal.target ?? null, course_id: goal.course ? byName.get(goal.course) ?? null : null, sealed: true });
      }
      await patch("/planner/settings", { daily_capacity_minutes: dailyCapacity(rhythm.focusHours, rhythm.studyDays), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      await put("/term", { name: termName.trim() || "My term", start_date: termStart, weeks });
      await qc.invalidateQueries({ queryKey: ["term"] });
      refreshPlans(qc);
      toast("The map is drawn. Fair winds!");
      navigate("/", { replace: true });
    } catch (e) {
      say(`The sea is rough: ${(e as Error).message}. Try again in a moment.`);
    } finally {
      setBusy(false);
    }
  }

  const canNext = step !== 2 || courses.length > 0;
  const weekOptions = Array.from(new Set([Math.max(currentWeek, weeks - 3), weeks - 2, weeks - 1, weeks].map((w) => Math.max(currentWeek, Math.min(weeks, w))))).sort((a, b) => a - b);

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="onboarding">
        <section className="ob-map" aria-label="Your map">
          <div className="map-wrap">
            <svg className="map" viewBox="0 0 760 520" role="img" aria-label={`The voyage map: ${courses.length} course islands, ${Object.keys(guard).length} guardians, ${sealCount} goals sealed in the chest`}>
              {defs}
              <rect x="4" y="2" width="752" height="516" rx="18" fill="#DCE0D0" stroke={LINE} />
              <rect x="4" y="2" width="752" height="516" rx="18" filter={`url(#${ids.grain})`} />
              <circle cx="380" cy="270" r="190" fill="none" stroke="#8FA58A" strokeWidth="28" strokeLinecap="round" pathLength={100} strokeDasharray="88 100" transform="rotate(-62 380 270)" opacity="0.22" />
              <path d={`M80,440 C${SLOTS.map(([x, y]) => `${x},${y}`).join(" ")} ${CHEST[0]},${CHEST[1]}`} fill="none" stroke="#B23A2E" strokeWidth="2.4" strokeDasharray="1 7" strokeLinecap="round" />
              <text x="80" y="470" textAnchor="middle" fontFamily="'IM Fell English SC', serif" fontSize="14" fill="#1F1E1B">{termName || "Your voyage"} · {weeks} weeks</text>
              {courses.map((c, i) => {
                const [x, y] = SLOTS[i];
                const g = guard[c.name];
                return (
                  <g key={c.name} transform={`translate(${x} ${y})`}>
                    <g transform="scale(1.15)"><Island shape={i % 2 ? "peak" : "isle"} /></g>
                    <g transform="translate(0 50)"><Ribbon label={c.name.length > 12 ? c.glyph + " " + c.name.split(" ")[0] : c.name} /></g>
                    {g && <g transform="translate(46 -30)"><GuardianBadge guardian={g.g} /></g>}
                  </g>
                );
              })}
              <foreignObject x={CHEST[0] - 40} y={CHEST[1] - 40} width="80" height="66"><Chest open={sealCount > 0} size={80} /></foreignObject>
              <text x={CHEST[0]} y={CHEST[1] + 46} textAnchor="middle" fontFamily="'IM Fell English SC', serif" fontSize="13" fill="#1F1E1B">{sealCount} sealed</text>
            </svg>
            {step === 3 && courses.map((c, i) => (
              <DropIsland key={c.name} id={`course:${c.name}`} x={SLOTS[i][0]} y={SLOTS[i][1]} label={`${c.name}${guard[c.name] ? `, guarded by ${GUARDIANS[guard[c.name].g].name}` : ""}${pickedG ? `. Place ${GUARDIANS[pickedG].name} here` : ""}`} onClick={() => assign(c.name, pickedG)} />
            ))}
            {step === 4 && <ChestTarget count={sealCount} onClick={() => say("Press Seal on a goal, or drag it here.")} />}
          </div>
        </section>

        <aside className="ob-guide" aria-label="Your guide and this step">
          <div className="monk-says">
            <MonkBust size={88} />
            <div className="monk-bubble" aria-live="polite">
              <span className="eyebrow">The monk</span>
              <p>{monk}</p>
            </div>
          </div>
          <div>
            <div className="steps" aria-hidden="true">{TITLES.map((t, i) => <span key={t} className={i < step ? "on" : ""} />)}</div>
            <span className="tiny muted">Step {step} of 6</span>
            <h1 className="title-l">{TITLES[step - 1]}</h1>
          </div>

          {step === 1 && (
            <div className="stack">
              <div className="field"><label className="label" htmlFor="ob-term">Name your voyage</label><input id="ob-term" className="input" value={termName} onChange={(e) => setTermName(e.target.value)} placeholder="e.g. Autumn term" maxLength={80} /></div>
              <div className="field"><label className="label" htmlFor="ob-start">It began (or begins) on</label><input id="ob-start" className="input" type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></div>
              <fieldset>
                <legend className="label">How many weeks is the crossing?</legend>
                <div className="row">{[10, 12, 14, 16].map((w) => <button key={w} type="button" className="chip" aria-pressed={weeks === w} onClick={() => setWeeks(w)}>{w} weeks</button>)}</div>
              </fieldset>
            </div>
          )}

          {step === 2 && (
            <div className="stack">
              <span className="label">Tap your courses (up to 5)</span>
              <div className="row">
                {[...PRESETS, ...courses.filter((c) => !PRESETS.some(([n]) => n === c.name)).map((c) => [c.name, c.glyph] as [string, string])].map(([n, gl]) => (
                  <button key={n} type="button" className="chip" aria-pressed={courses.some((c) => c.name === n)} onClick={() => toggleCourse(n, gl)}>
                    <span aria-hidden="true" style={{ fontFamily: "var(--serif)", fontWeight: 700 }}>{gl}</span>{n}
                  </button>
                ))}
              </div>
              <form className="row" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { toggleCourse(draft.trim(), draft.trim()[0].toUpperCase()); setDraft(""); } }}>
                <label htmlFor="ob-course" className="sr-only">Another course</label>
                <input id="ob-course" className="input" style={{ flex: 1, minWidth: 160 }} value={draft} maxLength={80} onChange={(e) => setDraft(e.target.value)} placeholder="Another course" />
                <button type="submit" className="btn">Add</button>
              </form>
            </div>
          )}

          {step === 3 && (
            <div className="stack">
              <span className="label">Drag a guardian onto an island on the map, or pick one and press a course below</span>
              <div className="row">
                {(Object.keys(GUARDIANS) as Guardian[]).map((g) => (
                  <Draggable key={g} id={`guardian:${g}`} className="chip red" pressed={pickedG === g} onClick={() => setPickedG(pickedG === g ? null : g)}>
                    {GUARDIANS[g].name}
                  </Draggable>
                ))}
              </div>
              <ul className="list">
                {courses.map((c) => {
                  const g = guard[c.name];
                  return (
                    <li key={c.name} className="card stack" style={{ padding: "10px 12px" }}>
                      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                        <button type="button" className="btn btn-small" onClick={() => assign(c.name, pickedG)}>{c.name}</button>
                        <span className="small">{g ? GUARDIANS[g.g].name : "No exam"}</span>
                        {g && <button type="button" className="btn btn-small" aria-label={`Remove the guardian from ${c.name}`} onClick={() => { const n = { ...guard }; delete n[c.name]; setGuard(n); }}>Remove</button>}
                      </div>
                      {g && (
                        <div role="group" aria-label={`Exam week for ${c.name}`} className="row" style={{ alignItems: "center" }}>
                          <span className="tiny">Exam in week</span>
                          {weekOptions.map((w) => <button key={w} type="button" className="chip" aria-pressed={g.week === w} onClick={() => setGuard({ ...guard, [c.name]: { ...g, week: w } })}>{w}</button>)}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="tiny muted" style={{ margin: 0 }}>Each exam goes on the Friday of its week at 09:00. You can change the date later.</p>
            </div>
          )}

          {step === 4 && (
            <div className="stack">
              <span className="label">Drag the goals you mean into the chest on the map, or press Seal</span>
              {goals.map((g) => (
                <div key={g.id} className="card stack" style={{ padding: "10px 12px" }}>
                  <div className="row" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "nowrap" }}>
                    <Draggable id={`goal:${g.id}`} className="pick" onClick={() => seal(g.id)} label={`${g.text}. Press to ${sealed.has(g.id) ? "unseal" : "seal"}`}>
                      <span className="quest-text"><span className="tiny muted">{g.type === "grade" ? "Grade target" : "Exam outcome"}</span><span className="quest-title">{g.text}</span></span>
                    </Draggable>
                    <button type="button" className="btn btn-small" aria-pressed={sealed.has(g.id)} onClick={() => seal(g.id)}>{sealed.has(g.id) ? "Sealed" : "Seal"}</button>
                  </div>
                  {g.type === "grade" && (
                    <div role="group" aria-label={`Grade target for ${g.course}`} className="row">
                      {GRADES.map((gr) => <button key={gr} type="button" className="chip" aria-pressed={(grade[g.course!] ?? "B") === gr} onClick={() => setGrade({ ...grade, [g.course!]: gr })}>{gr}</button>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 5 && (
            <div className="stack">
              <div className="field">
                <label className="label split" htmlFor="ob-focus"><span>Focus time each week</span><span>{rhythm.focusHours} h</span></label>
                <input id="ob-focus" type="range" min={0} max={25} step={1} value={rhythm.focusHours} onChange={(e) => setRhythm({ ...rhythm, focusHours: Number(e.target.value) })} />
              </div>
              <fieldset><legend className="label">Study days a week</legend><div className="row">{[3, 4, 5, 6, 7].map((d) => <button key={d} type="button" className="chip" aria-pressed={rhythm.studyDays === d} onClick={() => setRhythm({ ...rhythm, studyDays: d })}>{d}</button>)}</div></fieldset>
              <fieldset><legend className="label">A day the tide rests</legend><div className="row">{(["Fri", "Sat", "Sun", "None"] as const).map((d) => <button key={d} type="button" className="chip" aria-pressed={rhythm.rest === d} onClick={() => setRhythm({ ...rhythm, rest: d })}>{d}</button>)}</div></fieldset>
              <fieldset><legend className="label">Lay down the oars by</legend><div className="row">{["21:00", "22:00", "23:00", "None"].map((c) => <button key={c} type="button" className="chip" aria-pressed={rhythm.cutoff === c} onClick={() => setRhythm({ ...rhythm, cutoff: c })}>{c}</button>)}</div></fieldset>
              <p className="small" style={{ margin: 0 }}>{load.line} That's about {Math.round(dailyCapacity(rhythm.focusHours, rhythm.studyDays))} minutes of study on each study day.</p>
            </div>
          )}

          {step === 6 && (
            <div className="stack">
              <div className="card"><span className="label">Voyage</span><p style={{ margin: 0 }}>{termName || "My term"} · {weeks} weeks from {start}</p></div>
              <div className="card"><span className="label">Islands</span><p style={{ margin: 0 }}>{courses.map((c) => c.name).join(", ") || "None yet"}</p></div>
              <div className="card"><span className="label">Guardians</span><p style={{ margin: 0 }}>{Object.entries(guard).map(([c, g]) => `${GUARDIANS[g.g].name} · ${c}, week ${g.week}`).join("; ") || "No exams"}</p></div>
              <div className="card"><span className="label">Treasure</span><ul style={{ margin: 0, paddingLeft: 18 }}>{[...goals.filter((g) => sealed.has(g.id)), ...habits].map((g) => <li key={g.id}>{g.text}</li>)}</ul></div>
              <p className="tiny muted" style={{ margin: 0 }}>You can change any of this later in the Chart room.</p>
            </div>
          )}

          <div className="row" style={{ justifyContent: "space-between" }}>
            {step > 1 ? <button type="button" className="btn" onClick={() => go(step - 1)}>Back</button> : <span />}
            {step < 6 ? (
              <button type="button" className="btn btn-moss" disabled={!canNext} onClick={() => go(step + 1)}>{step === 5 ? "Draw the map" : "Next"}</button>
            ) : (
              <button type="button" className="btn btn-moss" onClick={setSail} disabled={busy}>{busy ? "Drawing…" : "Set sail"}</button>
            )}
          </div>
          {step === 2 && !canNext && <p className="tiny muted" style={{ margin: 0 }}>Choose at least one course to continue.</p>}
          <p className="tiny" style={{ margin: 0 }}>Your term starts {start}; it ends {addDays(start, weeks * 7 - 1)}.</p>
        </aside>
      </div>
    </DndContext>
  );
}
