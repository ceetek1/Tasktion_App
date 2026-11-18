import { useDraggable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import { taskMeta } from "../lib/voyage";
import type { Task } from "../lib/types";
import { Grip, ReturnIcon, Tick } from "./Icons";

const tint = (t: Task, colours: Map<number, string>) => (t.course_id != null ? colours.get(t.course_id) : undefined) ?? "#8E877A";

/** A quest on an island: tick it off, start a focus session, or send it back to the harbour */
export function QuestRow({
  task, colours, onToggle, onFocus, onUnplan,
}: {
  task: Task;
  colours: Map<number, string>;
  onToggle: () => void;
  onFocus?: () => void;
  onUnplan?: () => void;
}) {
  const done = task.status === "completed";
  return (
    <li className={`quest${done ? " done" : ""}`}>
      <button type="button" className="check" aria-pressed={done} aria-label={`${done ? "Mark not done" : "Mark done"}: ${task.title}`} onClick={onToggle}>
        <span className="check-box">{done && <Tick />}</span>
      </button>
      <span className="quest-text">
        <span className="quest-title">{task.title}</span>
        <span className="quest-meta">{taskMeta(task) || "Quest"}{task.estimate_minutes ? ` · ~${task.estimate_minutes} min` : ""}</span>
      </span>
      <span className="dot" style={{ background: tint(task, colours) }} aria-hidden="true" />
      {onFocus && !done && (
        <button type="button" className="btn btn-small" onClick={onFocus} aria-label={`Focus on ${task.title}`}>
          Focus
        </button>
      )}
      {onUnplan && !done && (
        <button type="button" className="icon-btn" onClick={onUnplan} aria-label={`Send ${task.title} back to the harbour`} title="Back to the harbour">
          <ReturnIcon />
        </button>
      )}
    </li>
  );
}

/** A quest waiting in the harbour. Drag it onto an island, or press it and then pick an island. */
export function HarbourItem({
  task, colours, picked, onPick, meta,
}: {
  task: Task;
  colours: Map<number, string>;
  picked: boolean;
  onPick: () => void;
  meta: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `task-${task.id}`, data: { task } });
  // Keyboard users pick-then-place; dnd-kit's own keyboard handling would fight with that
  const { role: _role, tabIndex: _tabIndex, ...aria } = attributes;
  const style: CSSProperties = { opacity: isDragging ? 0.4 : undefined };
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="pick harbour-item"
      aria-pressed={picked}
      aria-describedby={aria["aria-describedby"]}
      onClick={onPick}
      style={style}
      {...listeners}
    >
      <Grip />
      <span className="dot" style={{ background: tint(task, colours) }} aria-hidden="true" />
      <span className="quest-text">
        <span className="quest-title">{task.title}</span>
        <span className="quest-meta">{meta}</span>
      </span>
    </button>
  );
}

export function courseColours(courses: { id: number; colour: string }[] | undefined): Map<number, string> {
  return new Map((courses ?? []).map((c) => [c.id, c.colour]));
}
