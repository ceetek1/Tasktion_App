import { useState, type FormEvent } from "react";
import { MonkBust } from "../art/Art";
import { appUrl, supabase } from "../lib/supabase";

export function NotInvited({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="signin">
      <div className="card signin-card">
        <span className="eyebrow">Tasktion</span>
        <h1 className="title-l">You need an invite to sail</h1>
        <p className="small">This sign-in isn't part of the Tasktion group yet. Open your invite link from a member, or sign in with the account that was invited.</p>
        <button type="button" className="btn" onClick={onSignOut}>Use another account</button>
      </div>
    </div>
  );
}

export default function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function provider(p: "google" | "azure") {
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: p, options: { redirectTo: appUrl(), ...(p === "azure" ? { scopes: "email" } : {}) } });
    if (error) setMessage(error.message);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const result =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: appUrl(), data: name ? { full_name: name } : {} } });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === "up" && !result.data.session) setMessage("Check your email to confirm, then come back and sign in.");
  }

  return (
    <main className="signin">
      <div className="card signin-card">
        <div className="monk-says">
          <MonkBust size={72} />
          <div>
            <span className="eyebrow">Tasktion</span>
            <h1 className="title-l">The Voyage</h1>
          </div>
        </div>
        <p className="small" style={{ margin: 0 }}>Every term is a voyage. Sign in to see this week's islands.</p>
        <button type="button" className="btn" onClick={() => provider("google")}>Continue with Google</button>
        <button type="button" className="btn" onClick={() => provider("azure")}>Continue with Microsoft</button>
        <form className="stack" onSubmit={submit} aria-label={mode === "in" ? "Sign in with email" : "Create an account"}>
          {mode === "up" && (
            <div className="field"><label className="label" htmlFor="si-name">Your name</label><input id="si-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
          )}
          <div className="field"><label className="label" htmlFor="si-email">Email</label><input id="si-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          <div className="field"><label className="label" htmlFor="si-pass">Password</label><input id="si-pass" className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} /></div>
          <p className="error" role="alert">{message}</p>
          <button type="submit" className="btn btn-moss" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</button>
        </form>
        <button type="button" className="btn btn-small" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
        <a className="small" href="/pages/login.html?reset=1">Forgot your password?</a>
      </div>
    </main>
  );
}
