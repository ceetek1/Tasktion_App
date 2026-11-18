import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { del, get, patch, post, put } from "./api";
import type {
  AccessToken, Boss, Course, ClassSession, FocusSession, Goal, History, Me, Settings, Task, Term, TodayPlan, WeekPlan,
} from "./types";

export const keys = {
  me: ["me"] as const,
  term: ["term"] as const,
  today: ["planner", "today"] as const,
  week: (start: string) => ["planner", "week", start] as const,
  history: ["planner", "history"] as const,
  courses: ["courses"] as const,
  bosses: ["bosses"] as const,
  goals: ["goals"] as const,
  focus: ["focus"] as const,
  settings: ["settings"] as const,
  tokens: ["tokens"] as const,
};

export const useMe = (enabled = true) => useQuery({ queryKey: keys.me, queryFn: () => get<Me>("/auth/me"), enabled, retry: false });
export const useTerm = (enabled = true) => useQuery({ queryKey: keys.term, queryFn: () => get<Term>("/term"), enabled });
export const useToday = () => useQuery({ queryKey: keys.today, queryFn: () => get<TodayPlan>("/planner/today") });
export const useWeek = (start: string | undefined) =>
  useQuery({ queryKey: keys.week(start ?? ""), queryFn: () => get<WeekPlan>(`/planner/week?start=${start}`), enabled: !!start });
export const useHistory = () => useQuery({ queryKey: keys.history, queryFn: () => get<History>("/planner/history") });
export const useCourses = () => useQuery({ queryKey: keys.courses, queryFn: () => get<Course[]>("/courses") });
export const useBosses = () => useQuery({ queryKey: keys.bosses, queryFn: () => get<Boss[]>("/bosses") });
export const useGoals = () => useQuery({ queryKey: keys.goals, queryFn: () => get<Goal[]>("/goals") });
export const useFocusWeek = () =>
  useQuery({ queryKey: keys.focus, queryFn: () => get<{ sessions: FocusSession[]; total_minutes: number }>("/focus-sessions") });
export const useSettings = (enabled = true) => useQuery({ queryKey: keys.settings, queryFn: () => get<Settings>("/planner/settings"), enabled });
export const useTokens = () => useQuery({ queryKey: keys.tokens, queryFn: () => get<AccessToken[]>("/tokens") });

/** Anything that changes tasks can change every planner view */
export function refreshPlans(qc: QueryClient) {
  for (const key of [["planner"], ["task"], keys.bosses, keys.courses, keys.focus]) qc.invalidateQueries({ queryKey: key });
}

export type TaskDraft = Partial<Omit<Task, "id" | "user_id" | "completed_at" | "course">> & { course?: string | null };

export function useTaskActions() {
  const qc = useQueryClient();
  const onSuccess = () => refreshPlans(qc);
  const create = useMutation({ mutationFn: (body: TaskDraft) => post<Task>("/tasks", body), onSuccess });
  const update = useMutation({
    mutationFn: ({ id, ...body }: TaskDraft & { id: number }) => patch<Task>(`/tasks/${id}`, body),
    onSuccess,
  });
  return {
    create,
    update,
    toggleDone: (t: Task) => update.mutateAsync({ id: t.id, status: t.status === "completed" ? "pending" : "completed" }),
    plan: (id: number, day: string | null) => update.mutateAsync({ id, planned_for: day }),
  };
}

export function useCourseActions() {
  const qc = useQueryClient();
  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: keys.courses });
    qc.invalidateQueries({ queryKey: ["planner"] });
  };
  return {
    createCourse: useMutation({ mutationFn: (b: { name: string; glyph?: string; colour?: string }) => post<Course>("/courses", b), onSuccess }),
    deleteCourse: useMutation({ mutationFn: (id: number) => del(`/courses/${id}`), onSuccess }),
    createClass: useMutation({ mutationFn: (b: Omit<ClassSession, "id">) => post<ClassSession>("/classes", b), onSuccess }),
    deleteClass: useMutation({ mutationFn: (id: number) => del(`/classes/${id}`), onSuccess }),
  };
}

export function useSettingsAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: Partial<Settings>) => patch<Settings>("/planner/settings", b),
    onSuccess: (s) => {
      qc.setQueryData(keys.settings, s);
      qc.invalidateQueries({ queryKey: ["planner"] });
    },
  });
}

export function useTermAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { name: string; start_date: string; weeks: number }) => put<Term>("/term", b),
    onSuccess: (t) => {
      qc.setQueryData(keys.term, t);
      qc.invalidateQueries({ queryKey: ["planner"] });
    },
  });
}
