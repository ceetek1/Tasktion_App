import { useDroppable } from "@dnd-kit/core";
import { CheckMedal, Compass, Fog, GuardianBadge, Island, LINE, Ribbon, XMark, usePaper } from "../art/Art";
import { dayNumber, shortWeekday, weekdayName } from "../lib/dates";
import type { DayPlan } from "../lib/types";
import { islandCard, islandLayout, mapSize, trailPath, type DayState, type MapVariant } from "../lib/voyage";

interface Props {
  variant: MapVariant;
  days: DayPlan[];
  states: DayState[];
  selected: string;
  /** a quest is picked up and waiting to be placed */
  armed: boolean;
  onIsland: (day: string) => void;
}

function IslandButton({ day, state, left, top, width, height, selected, armed, onClick }: {
  day: DayPlan; state: DayState; left: string; top: string; width: string; height: string; selected: boolean; armed: boolean; onClick: () => void;
}) {
  const past = state.kind === "past" || (state.kind === "cleared" && !state.isToday);
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day.date}`, data: { day: day.date }, disabled: past && !state.isToday });
  const card = islandCard(day, state);
  const label = `${weekdayName(day.date)} ${dayNumber(day.date)}: ${card.title}${armed && !past ? ". Place the picked quest here" : ""}`;
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="isle-btn"
      aria-label={label}
      aria-pressed={selected}
      data-over={isOver || undefined}
      data-target={(armed && !past) || undefined}
      onClick={onClick}
      style={{ left, top, width, height }}
    />
  );
}

export default function VoyageMap({ variant, days, states, selected, armed, onIsland }: Props) {
  const { ids, defs } = usePaper();
  const spots = islandLayout(variant);
  const { width, height } = mapSize(variant);
  const todayIndex = Math.max(0, states.findIndex((s) => s.isToday));
  const sailed = trailPath(spots.slice(0, todayIndex + 1));
  const ahead = trailPath(spots.slice(todayIndex));
  const r = variant === "phone" ? 50 : 56;
  const scale = variant === "phone" ? 1 : 1.15;

  const description =
    "This week's voyage: seven day-islands linked by a red trail. " +
    states
      .map((s, i) => `${shortWeekday(days[i].date)} ${dayNumber(days[i].date)} ${s.kind === "fog" ? "is in fog" : s.kind === "boss" ? "has an exam" : s.kind === "cleared" ? "is cleared" : s.isToday ? "is today" : ""}`.trim())
      .filter((t) => /is |has /.test(t))
      .join(", ") + ".";

  return (
    <div className="map-wrap">
      <svg className="map" role="img" aria-label={description} viewBox={`0 0 ${width} ${height}`}>
        {defs}
        <rect x="4" y="2" width={width - 8} height={height - 4} rx="18" fill="#DCE0D0" stroke={LINE} />
        <rect x="4" y="2" width={width - 8} height={height - 4} rx="18" filter={`url(#${ids.grain})`} />
        <circle
          cx={width / 2} cy={height / 2} r={Math.min(width, height) * 0.38} fill="none" stroke="#8FA58A" strokeWidth="28"
          strokeLinecap="round" pathLength={100} strokeDasharray="88 100" transform={`rotate(-62 ${width / 2} ${height / 2})`} opacity="0.22"
        />
        <g fill="none" stroke="#5F8A8B" strokeWidth="1.2" strokeLinecap="round" opacity="0.55">
          {[[0.07, 0.42], [0.82, 0.34], [0.45, 0.24], [0.08, 0.8], [0.84, 0.92], [0.54, 0.94], [0.49, 0.43]].map(([fx, fy]) => (
            <path key={`${fx}-${fy}`} d={`M${fx * width} ${fy * height} q5 -5 10 0 q5 -5 10 0`} />
          ))}
        </g>
        <g transform={`translate(${width - 40} 38)`}><Compass /></g>

        <path d={sailed} fill="none" stroke="#B23A2E" strokeWidth="2.6" strokeDasharray="7 5" strokeLinecap="round" />
        <path d={ahead} fill="none" stroke="#B23A2E" strokeWidth="2.4" strokeDasharray="1 7" strokeLinecap="round" opacity="0.8" />

        {spots.map((s, i) => {
          const state = states[i];
          if (!state) return null;
          const day = days[i];
          return (
            <g key={day.date} transform={`translate(${s.x} ${s.y})`}>
              {state.isToday && <circle r="58" fill={`url(#${ids.glow})`} />}
              <g transform={`scale(${scale})`}>
                <Island shape={s.shape} faded={state.kind === "past"} />
              </g>
              {state.kind === "cleared" && <g transform="translate(30 -24)"><CheckMedal /></g>}
              {state.kind === "boss" && (
                <>
                  <g transform="translate(-6 -6)"><XMark /></g>
                  <g transform={`translate(${s.x > width / 2 ? -70 : 70} 10)`}><GuardianBadge guardian={state.exams[0]?.guardian ?? null} /></g>
                </>
              )}
              {state.kind === "fog" && <Fog soft={ids.soft} />}
              <circle r={r} fill="none" stroke="#1F1E1B" strokeWidth="1.4" strokeDasharray="3 4" opacity={selected === day.date ? 1 : 0} />
              <g transform={`translate(0 ${variant === "phone" ? 42 : 50})`}>
                <Ribbon label={`${shortWeekday(day.date)} ${dayNumber(day.date)}`} red={state.isToday} />
              </g>
            </g>
          );
        })}
      </svg>
      {spots.map((s, i) => {
        const day = days[i];
        if (!day || !states[i]) return null;
        const size = variant === "phone" ? 84 : 100;
        return (
          <IslandButton
            key={day.date}
            day={day}
            state={states[i]}
            selected={selected === day.date}
            armed={armed}
            onClick={() => onIsland(day.date)}
            left={`${((s.x - size / 2) / width) * 100}%`}
            top={`${((s.y - size / 2) / height) * 100}%`}
            width={`${(size / width) * 100}%`}
            height={`${(size / height) * 100}%`}
          />
        );
      })}
    </div>
  );
}
