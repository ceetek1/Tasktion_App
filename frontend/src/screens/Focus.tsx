import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { MonkScene } from "../art/Art";
import { useToast } from "../components/Toast";
import { del, get, post } from "../lib/api";
import { minutesLabel } from "../lib/dates";
import { refreshPlans, useFocusWeek, useToday } from "../lib/queries";
import type { FocusSession, Task } from "../lib/types";
import { useStored } from "../lib/useWide";
import { taskMeta } from "../lib/voyage";

const LENGTHS = [25, 50, 90];

interface Running {
  id: number;
  taskId: number | null;
  title: string | null;
  length: number;
  startedAt: number;
  pausedAt: number | null;
  pausedMs: number;
}

function elapsedMs(r: Running, now: number) {
  return (r.pausedAt ?? now) - r.startedAt - r.pausedMs;
}

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function Focus() {
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();
  const today = useToday();
  const week = useFocusWeek();
  const wanted = params.get("task") ? Number(params.get("task")) : null;
  const linked = useQuery({ queryKey: ["task", wanted], queryFn: () => get<Task>(`/tasks/${wanted}`), enabled: wanted !== null });

  const [length, setLength] = useState(25);
  const [taskId, setTaskId] = useState<number | null>(wanted);
  const [running, setRunning] = useStored<Running | null>("tasktion.focus", null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!running || running.pausedAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const options = useMemo(() => {
    const d = today.data;
    const seen = new Set<number>();
    const all = [...(linked.data ? [linked.data] : []), ...(d ? [...d.planned, ...d.slipped, ...d.overdue, ...d.due_soon] : [])];
    return all.filter((t) => t.status !== "completed" && t.kind !== "exam" && !seen.has(t.id) && seen.add(t.id));
  }, [today.data, linked.data]);

  const remaining = running ? running.length * 60_000 - elapsedMs(running, now) : length * 60_000;
  const finished = !!running && remaining <= 0;
  const progress = running ? Math.min(1, elapsedMs(running, now) / (running.length * 60_000)) : 0;

  async function start() {
    setBusy(true);
    try {
      const s = await post<FocusSession>("/focus-sessions", { task_id: taskId, minutes: length });
      const title = options.find((t) => t.id === taskId)?.title ?? null;
      setRunning({ id: s.id, taskId, title, length, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
      setNow(Date.now());
    } catch (e) {
      toast(`Couldn't start: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function togglePause() {
    if (!running) return;
    const t = Date.now();
    setRunning(running.pausedAt ? { ...running, pausedMs: running.pausedMs + (t - running.pausedAt), pausedAt: null } : { ...running, pausedAt: t });
    setNow(t);
  }

  async function finish(completeTask: boolean) {
    if (!running) return;
    const minutes = Math.min(running.length, Math.floor(elapsedMs(running, Date.now()) / 60_000));
    setBusy(true);
    try {
      if (minutes < 1 && !finished) {
        await del(`/focus-sessions/${running.id}`);
        toast("Session dropped. Less than a minute isn't logged.");
      } else {
        await post(`/focus-sessions/${running.id}/finish`, { minutes: Math.max(1, finished ? running.length : minutes), complete_task: completeTask && running.taskId !== null });
        toast(completeTask && running.title ? `${minutesLabel(Math.max(1, minutes))} of focus · “${running.title}” done` : `${minutesLabel(Math.max(1, finished ? running.length : minutes))} of focus logged`);
      }
      setRunning(null);
      refreshPlans(qc);
    } catch (e) {
      toast(`Couldn't save the session: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const status = !running
    ? "Breathe in. Choose a quest and a length."
    : finished
      ? "The circle is complete."
      : running.pausedAt
        ? "Paused. The monk waits."
        : running.title
          ? `Focusing on ${running.title}`
          : "A free session";

  return (
    <div className="stack-l">
      <div>
        <span className="eyebrow">Meditation focus</span>
        <h1 className="title-xl">Sit beneath the ensō</h1>
        <p className="muted small" style={{ margin: "4px 0 0" }}>{week.data ? `${minutesLabel(week.data.total_minutes)} of focus in the last 7 days` : " "}</p>
      </div>
      <div className="focus-layout">
        <div className="monk-wrap">
          <MonkScene progress={progress} label={`A monk sits beneath an ensō circle, ${Math.round(progress * 100)}% complete`} />
          <div className="timer-box" aria-live="polite">
            <span role="timer" className="timer">{clock(remaining)}</span>
            <div className="small">{status}</div>
          </div>
        </div>

        <section className="focus-controls" aria-label="Focus session">
          {!running && (
            <>
              <div role="group" aria-label="Session length" className="row">
                {LENGTHS.map((m) => (
                  <button key={m} type="button" className="chip" aria-pressed={length === m} onClick={() => setLength(m)}>{m} min</button>
                ))}
              </div>
              <fieldset>
                <legend className="label">Focus on</legend>
                <div className="stack">
                  {options.map((t) => (
                    <button key={t.id} type="button" className="pick" aria-pressed={taskId === t.id} onClick={() => setTaskId(taskId === t.id ? null : t.id)}>
                      <span className="quest-text">
                        <span className="quest-title">{t.title}</span>
                        <span className="quest-meta">{taskMeta(t) || "Quest"}{t.boss_task_id ? " · strikes a boss" : ""}</span>
                      </span>
                    </button>
                  ))}
                  {options.length === 0 && <p className="empty">No quests for today. Sit anyway: a free session still counts towards your focus time.</p>}
                </div>
              </fieldset>
              <button type="button" className="btn btn-moss" onClick={start} disabled={busy}>Begin {length} minutes{taskId ? "" : " (free session)"}</button>
            </>
          )}
          {running && !finished && (
            <div className="row">
              <button type="button" className="btn btn-moss" onClick={togglePause}>{running.pausedAt ? "Resume" : "Pause"}</button>
              <button type="button" className="btn" onClick={() => finish(false)} disabled={busy}>End</button>
            </div>
          )}
          {finished && running && (
            <div className="card stack">
              <p style={{ margin: 0 }}>{running.title ? `Is “${running.title}” done?` : "Well sat."}</p>
              <div className="row">
                {running.title && <button type="button" className="btn btn-moss" onClick={() => finish(true)} disabled={busy}>Yes, mark it done</button>}
                <button type="button" className="btn" onClick={() => finish(false)} disabled={busy}>{running.title ? "Not yet" : "Log the session"}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
