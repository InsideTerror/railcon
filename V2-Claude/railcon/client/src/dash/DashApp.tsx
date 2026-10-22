import { useEffect, useMemo, useState } from "react";
import { api, ApiError, getToken, setToken } from "../lib/api";
import { clockHms, timeAgo } from "../lib/format";
import type { DashMessage, SessionStatusT } from "../lib/protocol";
import { CommandPanel } from "./CommandPanel";
import { FleetTable } from "./FleetTable";
import { useDash } from "./store";
import { Toasts, useToasts } from "./ui";

interface UserInfo {
  forteId: string;
  name: string;
  role: string;
}

function LoginScreen({ onLogin }: { onLogin: (u: UserInfo) => void }) {
  const [forteId, setForteId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: UserInfo }>("/api/auth/login", { method: "POST", body: { forteId: forteId.trim(), pin: pin.trim() } });
      setToken("dash", res.token);
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm rounded-2xl border border-obu-line bg-obu-panel p-6 flex flex-col gap-4">
        <div>
          <div className="text-3xl font-black text-sky-400">C.O.R.E.</div>
          <div className="text-obu-dim">Dispatch Centre</div>
        </div>
        <label className="text-sm text-obu-dim">
          Dispatcher ID
          <input className="mt-1 w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-2 text-lg text-obu-text" value={forteId} onChange={(e) => setForteId(e.target.value)} autoFocus autoComplete="username" />
        </label>
        <label className="text-sm text-obu-dim">
          PIN
          <input className="mt-1 w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-2 text-lg text-obu-text" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" />
        </label>
        {error && <div className="rounded-lg bg-bad/20 border border-bad text-bad px-3 py-2 text-sm">{error}</div>}
        <button className="rounded-lg bg-sky-500 text-black font-bold py-3 disabled:opacity-40" disabled={busy || !forteId || !pin}>
          Log in
        </button>
      </form>
    </div>
  );
}

function PanicBanner({ messages }: { messages: DashMessage[] }) {
  const push = useToasts((s) => s.push);
  const ackLocal = useDash((s) => s.ackLocal);
  const open = messages.filter((m) => m.type === "PANIC" && !m.acknowledged);
  if (open.length === 0) return null;

  async function ack(id: number) {
    try {
      await api(`/api/dispatch/messages/${id}/ack`, { method: "POST", scope: "dash" });
      ackLocal(id);
    } catch (e) {
      push("err", e instanceof ApiError ? e.message : "Could not acknowledge");
    }
  }

  return (
    <div className="bg-bad text-white">
      {open.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-4 px-4 py-2 border-b border-red-900 animate-pulse">
          <div className="font-bold">
            ⚠ PANIC · {m.content} <span className="font-normal opacity-80">({new Date(m.timestamp).toLocaleTimeString("en-GB")})</span>
          </div>
          <button className="rounded-lg bg-white text-bad font-black px-4 py-1" onClick={() => void ack(m.id)}>
            Acknowledge
          </button>
        </div>
      ))}
    </div>
  );
}

function MessageLog({ messages }: { messages: DashMessage[] }) {
  const [open, setOpen] = useState(true);
  const list = messages.slice(-100).reverse();
  const badge = (t: DashMessage["type"]) => (t === "PANIC" ? "bg-bad text-white" : t === "DISPATCH_POPUP" ? "bg-sky-700 text-white" : "bg-obu-panel2 text-obu-text");
  return (
    <div className="border-t border-obu-line bg-obu-panel shrink-0">
      <button className="w-full flex items-center justify-between px-4 py-2 text-sm font-bold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>Message log ({messages.length})</span>
        <span>{open ? "▼" : "▲"}</span>
      </button>
      {open && (
        <div className="max-h-56 overflow-y-auto px-4 pb-3 flex flex-col gap-1 text-sm">
          {list.length === 0 && <div className="text-obu-dim">No messages yet.</div>}
          {list.map((m) => (
            <div key={m.id} className="flex gap-3 items-baseline">
              <span className="text-obu-dim font-mono shrink-0">{new Date(m.timestamp).toLocaleTimeString("en-GB")}</span>
              <span className={`rounded px-1.5 text-xs font-bold shrink-0 ${badge(m.type)}`}>{m.type}</span>
              <span className="shrink-0 font-semibold">{m.fromName}</span>
              <span className="text-obu-text">{m.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Console({ user, onLogout }: { user: UserInfo; onLogout: () => void }) {
  const { connected, fleet, messages, start, stop } = useDash();
  const [tab, setTab] = useState<SessionStatusT>("ACTIVE");
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [, force] = useState(0);

  useEffect(() => {
    start();
    const c = setInterval(() => {
      setNow(new Date());
      force((n) => n + 1);
    }, 1000);
    return () => {
      clearInterval(c);
      stop();
    };
  }, [start, stop]);

  const rows = useMemo(() => Object.values(fleet), [fleet]);
  const counts: Record<SessionStatusT, number> = { ACTIVE: 0, IDLE: 0, NON_ACTIVE: 0 };
  for (const r of rows) counts[r.status] += 1;
  const visible = rows.filter((r) => r.status === tab);
  const selectedRow = selected ? fleet[selected] ?? null : null;
  const tabs: { id: SessionStatusT; label: string }[] = [
    { id: "ACTIVE", label: "Active" },
    { id: "IDLE", label: "Idle" },
    { id: "NON_ACTIVE", label: "Non-Active" },
  ];

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-6 px-4 h-14 bg-obu-panel border-b border-obu-line shrink-0">
        <div className="text-xl font-black text-sky-400">C.O.R.E. Dispatch</div>
        <span className={`text-xs font-bold px-2 py-1 rounded ${connected ? "bg-ok/20 text-ok" : "bg-bad/20 text-bad animate-pulse"}`}>{connected ? "LIVE" : "RECONNECTING…"}</span>
        <div className="text-sm text-obu-dim">
          {counts.ACTIVE} active · {counts.IDLE} idle · {counts.NON_ACTIVE} non-active
        </div>
        <div className="flex-1" />
        <div className="font-mono text-xl tabular-nums">{clockHms(now)}</div>
        <div className="text-sm">
          {user.name} <span className="text-obu-dim">({user.role.toLowerCase()})</span>
        </div>
        <button className="rounded-lg border border-obu-line bg-obu-panel2 px-3 py-1.5 text-sm" onClick={onLogout}>
          Log out
        </button>
      </header>

      <PanicBanner messages={messages} />

      <nav className="flex gap-1 px-4 pt-3 shrink-0" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-5 py-2 font-bold border border-b-0 ${tab === t.id ? "bg-obu-panel text-sky-400 border-obu-line" : "bg-obu-bg text-obu-dim border-transparent hover:text-obu-text"}`}
          >
            {t.label} <span className="ml-1 text-xs rounded-full bg-obu-panel2 px-2 py-0.5">{counts[t.id]}</span>
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-obu-dim self-center">Last update {rows.length ? timeAgo(Math.max(...rows.map((r) => r.lastSeen))) : "—"}</span>
      </nav>

      <div className="flex-1 flex min-h-0 border-t border-obu-line">
        <main className="flex-1 overflow-auto bg-obu-bg">
          <FleetTable rows={visible} selectedId={selected} onSelect={setSelected} />
        </main>
        {selectedRow && <CommandPanel key={selectedRow.clientId} row={selectedRow} allRows={rows} onClose={() => setSelected(null)} />}
      </div>

      <MessageLog messages={messages} />
    </div>
  );
}

export function DashApp() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [checking, setChecking] = useState(() => !!getToken("dash"));

  useEffect(() => {
    if (!getToken("dash")) return;
    api<UserInfo>("/api/auth/me", { scope: "dash" })
      .then(setUser)
      .catch(() => setToken("dash", null))
      .finally(() => setChecking(false));
  }, []);

  function logout() {
    setToken("dash", null);
    setUser(null);
  }

  return (
    <div className="h-full bg-obu-bg">
      {checking ? <div className="h-full flex items-center justify-center text-obu-dim">Checking session…</div> : user ? <Console user={user} onLogout={logout} /> : <LoginScreen onLogin={setUser} />}
      <Toasts />
    </div>
  );
}
