import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../components/Toast";
import { del, post } from "../lib/api";
import { keys, useMe, useSettings, useSettingsAction, useTokens } from "../lib/queries";
import { signOut } from "../lib/session";
import type { AccessToken } from "../lib/types";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function claudeConfig(token: string) {
  const root = "/path/to/Tasktion_App";
  return JSON.stringify(
    { mcpServers: { tasktion: { command: `${root}/tasktion_mcp/.venv/bin/python`, args: [`${root}/tasktion_mcp/server.py`], env: { TASKTION_URL: window.location.origin, TASKTION_TOKEN: token } } } },
    null,
    2,
  );
}

function Briefings() {
  const settings = useSettings();
  const save = useSettingsAction();
  const toast = useToast();
  const [draft, setDraft] = useState<{ morning: string; evening: string; capacity: number } | null>(null);
  if (!settings.data) return <p className="muted" role="status">Loading settings…</p>;
  const s = settings.data;
  const value = draft ?? { morning: s.morning_at, evening: s.evening_at, capacity: s.daily_capacity_minutes };
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ morning_at: value.morning, evening_at: value.evening, daily_capacity_minutes: value.capacity });
      setDraft(null);
      toast("Settings saved");
    } catch (err) {
      toast((err as Error).message);
    }
  }

  return (
    <section className="card stack" aria-labelledby="br-h">
      <h2 id="br-h" className="map-h">Briefing emails</h2>
      <label className="row" style={{ alignItems: "center", gap: 12, minHeight: 44 }}>
        <input type="checkbox" checked={s.briefings_enabled} onChange={(e) => save.mutate({ briefings_enabled: e.target.checked })} style={{ width: 22, height: 22, accentColor: "var(--moss)" }} />
        <span>Email me a morning plan and an evening review</span>
      </label>
      <form onSubmit={submit} className="stack">
        <div className="grid-2">
          <div className="field"><label className="label" htmlFor="s-morning">Morning briefing</label><input id="s-morning" className="input" type="time" value={value.morning} onChange={(e) => setDraft({ ...value, morning: e.target.value })} /></div>
          <div className="field"><label className="label" htmlFor="s-evening">Evening review</label><input id="s-evening" className="input" type="time" value={value.evening} onChange={(e) => setDraft({ ...value, evening: e.target.value })} /></div>
          <div className="field">
            <label className="label" htmlFor="s-cap">Study time a day (minutes)</label>
            <input id="s-cap" className="input" type="number" min={15} max={1440} step={15} value={value.capacity} onChange={(e) => setDraft({ ...value, capacity: Number(e.target.value) })} />
          </div>
        </div>
        <button type="submit" className="btn btn-moss" style={{ alignSelf: "flex-start" }} disabled={!draft || save.isPending}>Save</button>
      </form>
      <p className="small" style={{ margin: 0 }}>
        Times are in {s.timezone}.{" "}
        {deviceZone && deviceZone !== s.timezone && (
          <button type="button" className="btn btn-small" onClick={() => save.mutate({ timezone: deviceZone })}>Use {deviceZone}</button>
        )}
      </p>
    </section>
  );
}

function ConnectClaude() {
  const tokens = useTokens();
  const qc = useQueryClient();
  const toast = useToast();
  const [created, setCreated] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function make() {
    setError("");
    try {
      const t = await post<AccessToken>("/tokens", { name: "Claude Desktop" });
      setCreated(claudeConfig(t.token ?? ""));
      qc.invalidateQueries({ queryKey: keys.tokens });
    } catch (e) {
      setError(`Couldn't make a token: ${(e as Error).message}`);
    }
  }

  async function revoke(t: AccessToken) {
    try {
      await del(`/tokens/${t.id}`);
      setConfirming(null);
      qc.invalidateQueries({ queryKey: keys.tokens });
      toast(`Revoked. Anything using ${t.prefix}… is cut off.`);
    } catch (e) {
      setError(`Couldn't revoke it: ${(e as Error).message}`);
    }
  }

  return (
    <section className="card stack" aria-labelledby="cc-h">
      <h2 id="cc-h" className="map-h">Connect Claude Desktop</h2>
      <p className="small" style={{ margin: 0 }}>Plan your week by chatting with Claude. Make a token, paste the setup into Claude Desktop's <code>claude_desktop_config.json</code>, then restart Claude Desktop.</p>
      {created && (
        <div className="notice stack">
          <p className="small" style={{ margin: 0 }} id="cc-once">Here's your new token. Copy it now: Tasktion shows it only once.</p>
          <label className="label" htmlFor="cc-config">Setup for claude_desktop_config.json</label>
          <textarea id="cc-config" className="input" rows={13} readOnly value={created} spellCheck={false} aria-describedby="cc-once cc-path" style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, whiteSpace: "pre" }} onFocus={(e) => e.currentTarget.select()} />
          <p id="cc-path" className="tiny" style={{ margin: 0 }}>Change both <code>/path/to/Tasktion_App</code> parts to where Tasktion is on your Mac.</p>
          <div className="row">
            <button type="button" className="btn btn-small" onClick={async () => { try { await navigator.clipboard.writeText(created); toast("Copied! Paste it into claude_desktop_config.json."); } catch { toast("Your browser blocked copying. Select the text and copy it."); } }}>Copy setup</button>
            <button type="button" className="btn btn-small" onClick={() => setCreated(null)}>Hide</button>
          </div>
        </div>
      )}
      <h3 className="section-h">Your tokens</h3>
      <ul className="list">
        {(tokens.data ?? []).map((t) => (
          <li key={t.id} className="class-row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <span className="quest-text">
              <span className="quest-title">{t.name}</span>
              <span className="quest-meta">{t.prefix}… · made {shortDate(t.created_at)} · {t.last_used_at ? `last used ${shortDate(t.last_used_at)}` : "not used yet"}</span>
            </span>
            {confirming === t.id ? (
              <span className="row">
                <button type="button" className="btn btn-small" onClick={() => setConfirming(null)}>Keep it</button>
                <button type="button" className="btn btn-small btn-red" onClick={() => revoke(t)} aria-label={`Yes, revoke ${t.name} (${t.prefix})`}>Yes, revoke</button>
              </span>
            ) : (
              <button type="button" className="btn btn-small" onClick={() => setConfirming(t.id)} aria-label={`Revoke ${t.name} (${t.prefix})`}>Revoke</button>
            )}
          </li>
        ))}
      </ul>
      {tokens.data?.length === 0 && <p className="empty">No tokens yet. Claude Desktop can't reach your planner until you make one.</p>}
      <p className="error" role="alert">{error}</p>
      <button type="button" className="btn btn-moss" style={{ alignSelf: "flex-start" }} onClick={make}>Make a token</button>
    </section>
  );
}

export default function Settings() {
  const me = useMe();
  return (
    <div className="stack-l" style={{ maxWidth: 760 }}>
      <div>
        <span className="eyebrow">{me.data?.email ?? " "}</span>
        <h1 className="title-xl">Settings</h1>
      </div>
      <Briefings />
      <ConnectClaude />
      <section className="card stack" aria-labelledby="acc-h">
        <h2 id="acc-h" className="map-h">Account</h2>
        <div className="row">
          <a className="btn btn-small" href="/pages/dashboard.html">Open the classic task list</a>
          <button type="button" className="btn btn-small" onClick={signOut}>Sign out</button>
        </div>
      </section>
    </div>
  );
}
