// Shapes returned by the Tasktion API (see /docs)
export type Kind = "task" | "assignment" | "exam" | "reading" | "revision" | "study";
export type Status = "pending" | "in_progress" | "completed";
export type Guardian = "kraken" | "dragon" | "golem";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  due_date: string;
  status: Status;
  user_id: number;
  assigned_to: number | null;
  course_id: number | null;
  course: string | null;
  kind: Kind;
  planned_for: string | null;
  estimate_minutes: number | null;
  completed_at: string | null;
  guardian: Guardian | null;
  boss_task_id: number | null;
}

export interface ClassSession {
  id: number;
  course_id: number;
  weekday: number;
  starts_at: string;
  ends_at: string;
  place: string | null;
}

export interface DayClass extends ClassSession {
  course: string;
  colour: string;
}

export interface Course {
  id: number;
  name: string;
  glyph: string;
  colour: string;
  classes: ClassSession[];
}

export interface Load {
  load_minutes: number;
  capacity_minutes: number;
  over_capacity: boolean;
}

export interface DayPlan extends Load {
  date: string;
  tasks: Task[];
  due: Task[];
  classes: DayClass[];
}

export interface WeekPlan {
  start: string;
  timezone: string;
  days: DayPlan[];
  unplanned: Task[];
}

export interface TodayPlan {
  date: string;
  timezone: string;
  planned: Task[];
  slipped: Task[];
  overdue: Task[];
  due_soon: Task[];
  exams: Task[];
  classes: DayClass[];
  load: Load;
}

export interface Boss {
  exam: Task;
  guardian: Guardian | null;
  health: number;
  max_health: number;
  defeated: boolean;
  revision: Task[];
}

export interface Term {
  name: string | null;
  start_date: string | null;
  weeks: number | null;
  current_week: number | null;
  onboarded: boolean;
}

export interface Goal {
  id: number;
  type: "grade" | "exam" | "habit" | "balance";
  text: string;
  course_id: number | null;
  target: string | null;
  sealed_at: string | null;
}

export interface FocusSession {
  id: number;
  task_id: number | null;
  minutes: number;
  started_at: string;
  completed_at: string | null;
}

export interface DayRecord {
  date: string;
  planned: number;
  done: number;
  completed: number;
  focus_minutes: number;
}

export interface History {
  start: string;
  end: string;
  timezone: string;
  days: DayRecord[];
}

export interface Settings {
  timezone: string;
  daily_capacity_minutes: number;
  briefings_enabled: boolean;
  morning_at: string;
  evening_at: string;
}

export interface Me {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface AccessToken {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  token?: string;
}
