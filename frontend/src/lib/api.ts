import { config } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function describe(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (!detail) return fallback;
  if (Array.isArray(detail)) {
    return detail
      .map((d: { loc?: unknown[]; msg?: string }) => {
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
        const msg = (d.msg || "").replace(/^Value error, /, "");
        return field && field !== "body" ? `${field}: ${msg}` : msg;
      })
      .join("; ");
  }
  return String(detail);
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const { data } = await supabase.auth.getSession();
  if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  const response = await fetch(config.apiBase + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) throw new ApiError(describe(payload, response.statusText || "Request failed"), response.status);
  return payload as T;
}

export const get = <T>(path: string) => api<T>("GET", path);
export const post = <T>(path: string, body?: unknown) => api<T>("POST", path, body ?? {});
export const patch = <T>(path: string, body: unknown) => api<T>("PATCH", path, body);
export const put = <T>(path: string, body: unknown) => api<T>("PUT", path, body);
export const del = (path: string) => api<void>("DELETE", path);
