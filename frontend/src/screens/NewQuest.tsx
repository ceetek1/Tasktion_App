import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CloseIcon, SailIcon } from "../components/Icons";
import { useToast } from "../components/Toast";
import { addDays, dayNumber, localInstant, mondayOf, shortWeekday } from "../lib/dates";
import { useBosses, useCourses, useTaskActions, useToday } from "../lib/queries";
import type { Guardian, Kind } from "../lib/types";
import { useWide } from "../lib/useWide";
import { GUARDIANS, bossStatus, guardianName, sortBosses } from "../lib/voyage";

const KINDS: [Kind, string][] = [["assignment", "Assignment"], ["exam", "Exam"], ["reading", "Reading"], ["revision", "Revision"], ["study", "Study session"], ["task", "Other"]];
const ESTIMATES = [25, 45, 60, 90, 120];

export default function NewQuest() {
  const wide = useWide();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const today = useToday();
  const courses = useCourses();
  const bosses = useBosses();
  const { create } = useTaskActions();
  const todayDate = today.data?.date;

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>((params.get("kind") as Kind) || "assignment");
  const [courseId, setCourseId] = useState<number | null>(null);
  const [due, setDue] = useState("");
  const [time, setTime] = useState("17:00");
  const [day, setDay] = useState<string | null>(params.get("day"));
  const [estimate, setEstimate] = useState<number | null>(null);
  const [bossId, setBossId] = useState<number | null>(params.get("boss") ? Number(params.get("boss")) : null);
  const [guardian, setGuardian] = useState<Guardian>("kraken");
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => titleRef.current?.focus(), []);
  useEffect(() => {
    if (!due && todayDate) setDue(day && day >= todayDate ? day : addDays(todayDate, 1));
  }, [todayDate, day, due]);
  // A revision quest aimed at an exam usually belongs to the same course
  useEffect(() => {
    const boss = bosses.data?.find((b) => b.exam.id === bossId);
    if (boss?.exam.course_id && courseId === null) setCourseId(boss.exam.course_id);
  }, [bossId, bosses.data, courseId]);

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const weekStart = todayDate ? mondayOf(day ?? todayDate) : undefined;
  const days = weekStart ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [];
  const liveBosses = sortBosses(bosses.data ?? []).filter((b) => !b.defeated && b.exam.status !== "completed");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Give the quest a name.");
      titleRef.current?.focus();
      return;
    }
    if (!due) return setError("Choose when it's due.");
    const dueIso = localInstant(due, time || "23:59");
    if (new Date(dueIso) <= new Date()) return setError("The due time has already passed. Pick a later one.");
    setError("");
    try {
      await create.mutateAsync({
        title: title.trim(),
        kind,
        course_id: courseId,
        due_date: dueIso,
        planned_for: kind === "exam" ? null : day,
        estimate_minutes: estimate,
        guardian: kind === "exam" ? guardian : null,
        boss_task_id: kind === "revision" ? bossId : null,
      });
      toast(kind === "exam" ? `${guardianName(guardian)} now guards ${title.trim()}` : day ? `“${title.trim()}” sets sail` : `“${title.trim()}” waits in the harbour`);
      close();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const form = (
    <form onSubmit={submit} className="stack-l" noValidate aria-labelledby="nq-h">
      <div className="split" style={{ alignItems: "center" }}>
        <h1 id="nq-h" className="title-l">New quest</h1>
        <button type="button" className="icon-btn" onClick={close} aria-label="Close without saving"><CloseIcon /></button>
      </div>

      <div className="field">
        <label className="label" htmlFor="nq-title">What's the quest?</label>
        <input ref={titleRef} id="nq-title" className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Problem set 7" aria-invalid={!!error && !title.trim()} aria-describedby="nq-err" />
      </div>

      <fieldset>
        <legend className="label">Kind</legend>
        <div className="row">
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Course</legend>
        <div className="grid-2">
          {(courses.data ?? []).map((c) => (
            <button key={c.id} type="button" className="pick" aria-pressed={courseId === c.id} onClick={() => setCourseId(courseId === c.id ? null : c.id)}>
              <span className="glyph" style={{ background: c.colour }} aria-hidden="true">{c.glyph}</span>
              <span className="small" style={{ fontWeight: 600 }}>{c.name}</span>
            </button>
          ))}
        </div>
        {courses.data?.length === 0 && <p className="small muted">No courses yet. Add them in the Chart room.</p>}
      </fieldset>

      <div className="grid-2">
        <div className="field">
          <label className="label" htmlFor="nq-date">Due</label>
          <input id="nq-date" className="input" type="date" value={due} min={todayDate} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="nq-time">Time</label>
          <input id="nq-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      {kind !== "exam" && (
        <fieldset>
          <legend className="label">Plan it on an island</legend>
          <div className="days7">
            {days.map((d) => {
              const past = !!todayDate && d < todayDate;
              return (
                <button key={d} type="button" className="day-pick" disabled={past} aria-pressed={day === d} aria-label={`${shortWeekday(d)} ${dayNumber(d)}${past ? ", past" : ""}`} onClick={() => setDay(day === d ? null : d)}>
                  <span style={{ fontFamily: "var(--map)", fontSize: 13 }}>{shortWeekday(d)}</span>
                  <span style={{ fontWeight: 600 }}>{dayNumber(d)}</span>
                </button>
              );
            })}
          </div>
          <p className="tiny muted" style={{ margin: "8px 0 0" }}>
            {day ? `Lands on the ${shortWeekday(day)} ${dayNumber(day)} island. Press it again to leave the quest in the harbour.` : "Unplanned: it waits in the harbour until you place it."}
          </p>
        </fieldset>
      )}

      {kind !== "exam" && (
        <fieldset>
          <legend className="label">Takes about</legend>
          <div className="row">
            {ESTIMATES.map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={estimate === m} onClick={() => setEstimate(estimate === m ? null : m)}>{m < 60 ? `${m} min` : `${m / 60} h`.replace("1.5 h", "1½ h")}</button>
            ))}
          </div>
        </fieldset>
      )}

      {kind === "revision" && (
        <fieldset className="boss-box">
          <legend className="label">Strike a boss</legend>
          <div className="stack">
            {liveBosses.map((b) => (
              <button key={b.exam.id} type="button" className="pick" aria-pressed={bossId === b.exam.id} onClick={() => setBossId(bossId === b.exam.id ? null : b.exam.id)} style={{ justifyContent: "space-between" }}>
                <span className="quest-text">
                  <span className="quest-title">{guardianName(b.guardian)}</span>
                  <span className="quest-meta">{b.exam.title}</span>
                </span>
                <span className="small" style={{ color: "var(--red)", fontWeight: 600 }}>{bossStatus(b)}</span>
              </button>
            ))}
            {liveBosses.length === 0 && <p className="small" style={{ margin: 0 }}>No bosses yet. Add an exam first, then aim revision at it.</p>}
          </div>
          <p className="tiny" style={{ margin: "8px 0 0" }}>Finishing this quest lands one strike on the boss.</p>
        </fieldset>
      )}

      {kind === "exam" && (
        <fieldset className="boss-box">
          <legend className="label">Choose its guardian</legend>
          <div className="row">
            {(Object.keys(GUARDIANS) as Guardian[]).map((g) => (
              <button key={g} type="button" className="chip" aria-pressed={guardian === g} onClick={() => setGuardian(g)}>{GUARDIANS[g].short}</button>
            ))}
          </div>
          <p className="tiny" style={{ margin: "8px 0 0" }}>This exam becomes a boss. Add revision quests to wear it down before the day.</p>
        </fieldset>
      )}

      <p id="nq-err" className="error" role="alert">{error}</p>
      <div className="sticky-foot">
        <button type="button" className="btn" onClick={close}>Cancel</button>
        <button type="submit" className="btn btn-moss" disabled={create.isPending}>
          <SailIcon />{kind === "exam" ? "Summon the boss" : "Set sail"}
        </button>
      </div>
    </form>
  );

  if (!wide) return form;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="nq-h">{form}</div>
    </div>
  );
}
