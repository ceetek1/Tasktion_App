import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** The Supabase sign-in, or null when signed out; undefined while loading */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Offline: drop the stored sign-in anyway
    try {
      localStorage.removeItem((supabase.auth as unknown as { storageKey: string }).storageKey);
    } catch {
      /* storage blocked */
    }
  }
  window.location.href = import.meta.env.BASE_URL;
}
