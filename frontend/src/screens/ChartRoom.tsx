import { useState, type FormEvent } from "react";
import { useToast } from "../components/Toast";
import { useCourseActions, useCourses, useTerm, useTermAction } from "../lib/queries";
import type { Course } from "../lib/types";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PALETTE = ["#5F8A8B", "#B98A2F", "#4F6B4A", "#8A4B2E", "#46706F", "#B23A2E"];
const HOUR_PX = 56;

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function Timetable({ courses, filter }: { courses: Course[]; filter: number | null }) {
  const blocks = courses
    .filter((c) => filter === null || c.id === filter)
    .flatMap((c) => c.classes.map((s) => ({ ...s, course: c })));
  const weekend = blocks.some((b) => b.weekday >= 5);
  const days = weekend ? 7 : 5;
  const first = Math.min(9, ...blocks.map((b) => Math.floor(toMinutes(b.starts_at) / 60)));
  const last = Math.max(17, ...blocks.map((b) => Math.ceil(toMinutes(b.ends_at) / 60)));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  return (
    <div className="timetable">
      <div className="tt-grid" style={{ ["--days" as string]: days }} role="table" aria-label="Weekly timetable">
        <span role="columnheader" />
        {WEEKDAYS.slice(0, days).map((d) => <span key={d} role="columnheader" className="tt-head">{d.slice(0, 3)}</span>)}
        {hours.map((h) => (
          <div key={h} role="row" style={{ display: "contents" }}>
            <span role="rowheader" className="tt-hour">{String(h).padStart(2, "0")}:00</span>
            {Array.from({ length: days }, (_, d) => <span key={d} role="cell" className="tt-cell" />)}
          </div>
        ))}
        {blocks.map((b) => {
          const top = 37 + ((toMinutes(b.starts_at) - first * 60) / 60) * HOUR_PX;
          const height = Math.max(26, ((toMinutes(b.ends_at) - toMinutes(b.starts_at)) / 60) * HOUR_PX - 4);
          return (
            <div
              key={b.id}
              className="tt-block"
              style={{
                top, height, background: `${b.course.colour}40`,
                left: `calc(48px + (100% - 48px) / ${days} * ${b.weekday} + 3px)`, width: `calc((100% - 48px) / ${days} - 6px)`,
              }}
            >
              <strong>{b.course.name}</strong>
              <span>{b.starts_at}–{b.ends_at}{b.place ? ` · ${b.place}` : ""}</span>
            </div>
          );
        })}
      </div>
      {blocks.length === 0 && <p className="empty" style={{ marginTop: 8 }}>No classes charted yet. Add your weekly lectures and labs below.</p>}
    </div>
  );
}

function AddCourse() {
  const { createCourse } = useCourseActions();
  const toast = useToast();
  const [name, setName] = useState("");
  const [glyph, setGlyph] = useState("");
  const [colour, setColour] = useState(PALETTE[0]);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name the course.");
    try {
      await createCourse.mutateAsync({ name: name.trim(), glyph: glyph.trim() || undefined, colour });
      toast(`${name.trim()} rises on the map`);
      setName(""); setGlyph(""); setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <form className="card stack" onSubmit={submit} aria-labelledby="ac-h" noValidate>
      <h2 id="ac-h" className="map-h">Raise a new island (course)</h2>
      <div className="grid-2">
        <div className="field"><label className="label" htmlFor="ac-name">Course name</label><input id="ac-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Linear Algebra" /></div>
        <div className="field"><label className="label" htmlFor="ac-glyph">Glyph (optional)</label><input id="ac-glyph" className="input" value={glyph} maxLength={4} onChange={(e) => setGlyph(e.target.value)} placeholder="Σ" /></div>
      </div>
      <fieldset>
        <legend className="label">Colour</legend>
        <div className="swatches">
          {PALETTE.map((c) => <button key={c} type="button" className="swatch" style={{ background: c }} aria-pressed={colour === c} aria-label={`Colour ${c}`} onClick={() => setColour(c)} />)}
        </div>
      </fieldset>
      <p className="error" role="alert">{error}</p>
      <button type="submit" className="btn btn-moss" style={{ alignSelf: "flex-start" }} disabled={createCourse.isPending}>Add course</button>
    </form>
  );
}

function AddClass({ courses }: { courses: Course[] }) {
  const { createClass } = useCourseActions();
  const toast = useToast();
  const [courseId, setCourseId] = useState<number | "">(courses[0]?.id ?? "");
  const [weekday, setWeekday] = useState(0);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:30");
  const [place, setPlace] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const course = courseId === "" ? courses[0]?.id : courseId;
    if (course === undefined) return setError("Pick a course first.");
    if (end <= start) return setError("The class has to end after it starts.");
    try {
      await createClass.mutateAsync({ course_id: course, weekday, starts_at: start, ends_at: end, place: place.trim() || null });
      toast(`Class added on ${WEEKDAYS[weekday]}s`);
      setError(""); setPlace("");
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <form className="card stack" onSubmit={submit} aria-labelledby="acl-h" noValidate>
      <h2 id="acl-h" className="map-h">Add a weekly class</h2>
      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="acl-course">Course</label>
          <select id="acl-course" className="input" value={courseId} onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}>
            {courses.length === 0 && <option value="">Add a course first</option>}
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="acl-day">Day</label>
          <select id="acl-day" className="input" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
            {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="field"><label className="label" htmlFor="acl-start">Starts</label><input id="acl-start" className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="acl-end">Ends</label><input id="acl-end" className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <div className="field"><label className="label" htmlFor="acl-place">Where (optional)</label><input id="acl-place" className="input" value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} placeholder="Hall B" /></div>
      <p className="error" role="alert">{error}</p>
      <button type="submit" className="btn btn-moss" style={{ alignSelf: "flex-start" }} disabled={createClass.isPending || courses.length === 0}>Add class</button>
    </form>
  );
}

function TermForm() {
  const term = useTerm();
  const save = useTermAction();
  const toast = useToast();
  const [draft, setDraft] = useState<{ name: string; start: string; weeks: number } | null>(null);
  if (!term.data) return null;
  const value = draft ?? { name: term.data.name ?? "", start: term.data.start_date ?? "", weeks: term.data.weeks ?? 14 };
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ name: value.name.trim() || "My term", start_date: value.start, weeks: value.weeks });
      setDraft(null);
      toast("The voyage is renamed");
    } catch (err) {
      toast((err as Error).message);
    }
  }
  return (
    <form className="card stack" onSubmit={submit} aria-labelledby="term-h">
      <h2 id="term-h" className="map-h">The voyage (term)</h2>
      <div className="grid-2">
        <div className="field"><label className="label" htmlFor="t-name">Name</label><input id="t-name" className="input" value={value.name} maxLength={80} onChange={(e) => setDraft({ ...value, name: e.target.value })} /></div>
        <div className="field"><label className="label" htmlFor="t-start">Starts</label><input id="t-start" className="input" type="date" required value={value.start} onChange={(e) => setDraft({ ...value, start: e.target.value })} /></div>
        <div className="field"><label className="label" htmlFor="t-weeks">Weeks</label><input id="t-weeks" className="input" type="number" min={1} max={52} value={value.weeks} onChange={(e) => setDraft({ ...value, weeks: Number(e.target.value) })} /></div>
      </div>
      <button type="submit" className="btn" style={{ alignSelf: "flex-start" }} disabled={!draft || !value.start}>Save term</button>
    </form>
  );
}

export default function ChartRoom() {
  const courses = useCourses();
  const { deleteCourse, deleteClass } = useCourseActions();
  const toast = useToast();
  const [filter, setFilter] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  if (courses.isError) return <p className="notice" role="alert">Couldn't load the chart room: {courses.error.message}</p>;
  if (!courses.data) return <p className="muted" role="status">Unrolling the charts…</p>;
  const list = courses.data;
  const selected = list.find((c) => c.id === filter);

  return (
    <div className="stack-l">
      <div>
        <span className="eyebrow">Courses &amp; timetable</span>
        <h1 className="title-xl">Chart room</h1>
      </div>

      <section aria-label="Courses" className="course-grid">
        {list.map((c) => (
          <button key={c.id} type="button" className="course-card" aria-pressed={filter === c.id} onClick={() => setFilter(filter === c.id ? null : c.id)}>
            <span className="row" style={{ alignItems: "center", flexWrap: "nowrap" }}>
              <span className="glyph" style={{ background: c.colour }} aria-hidden="true">{c.glyph}</span>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
            </span>
            <span className="tiny muted">{c.classes.length} {c.classes.length === 1 ? "class" : "classes"} a week</span>
          </button>
        ))}
        {list.length === 0 && <p className="empty">No courses yet. Each course becomes an island on your map.</p>}
      </section>

      <section aria-labelledby="tt-h" className="card stack">
        <div className="split">
          <h2 id="tt-h" className="map-h">Weekly timetable</h2>
          <span className="small muted">{selected ? `Showing ${selected.name}` : "All courses"}</span>
        </div>
        <Timetable courses={list} filter={filter} />
      </section>

      {selected && (
        <section aria-labelledby="sel-h" className="card stack">
          <h2 id="sel-h" className="map-h">{selected.name}</h2>
          <ul className="list">
            {selected.classes.map((s) => (
              <li key={s.id} className="class-row" style={{ justifyContent: "space-between" }}>
                <span>{WEEKDAYS[s.weekday]} {s.starts_at}–{s.ends_at}{s.place ? ` · ${s.place}` : ""}</span>
                <button type="button" className="btn btn-small" onClick={() => deleteClass.mutate(s.id)} aria-label={`Remove the ${WEEKDAYS[s.weekday]} ${s.starts_at} class`}>Remove</button>
              </li>
            ))}
          </ul>
          {confirming === selected.id ? (
            <div className="notice row" style={{ alignItems: "center" }}>
              <span>Delete {selected.name} and its classes? Its quests stay, without a course.</span>
              <button type="button" className="btn btn-small" onClick={() => setConfirming(null)}>Keep it</button>
              <button type="button" className="btn btn-small btn-red" onClick={async () => { await deleteCourse.mutateAsync(selected.id); setConfirming(null); setFilter(null); toast(`${selected.name} sinks below the waves`); }}>Delete course</button>
            </div>
          ) : (
            <button type="button" className="btn btn-small" style={{ alignSelf: "flex-start" }} onClick={() => setConfirming(selected.id)}>Delete course…</button>
          )}
        </section>
      )}

      <div className="course-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
        <AddCourse />
        <AddClass courses={list} />
        <TermForm />
      </div>
    </div>
  );
}
