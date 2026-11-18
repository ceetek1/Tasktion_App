import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

export const supabase = createClient(config.supabaseUrl || "http://localhost", config.supabaseKey || "missing-key", {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// After Google/Microsoft, come back to the app itself
export const appUrl = () => new URL(import.meta.env.BASE_URL, window.location.origin).href;
