// Filled in by /js/config.js, which the server writes from its environment
declare global {
  interface Window {
    TASKTION_API_BASE?: string;
    TASKTION_SUPABASE_URL?: string;
    TASKTION_SUPABASE_KEY?: string;
  }
}

export const config = {
  apiBase: (window.TASKTION_API_BASE || "").replace(/\/$/, ""),
  supabaseUrl: window.TASKTION_SUPABASE_URL || "",
  supabaseKey: window.TASKTION_SUPABASE_KEY || "",
};
