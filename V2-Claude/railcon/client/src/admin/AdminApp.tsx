import { useState } from "react";
import { api, getToken, setToken } from "../lib/api";
import { CannedTab } from "./CannedTab";
import { ImportTab } from "./ImportTab";
import { RoutesTab } from "./RoutesTab";
import { StationsTab } from "./StationsTab";
import { TimetablesTab } from "./TimetablesTab";
import { UsersTab } from "./UsersTab";
import { errText, ErrorBox, inputCls, primaryCls } from "./ui";

type TabId = "users" | "stations" | "routes" | "timetables" | "canned" | "import";

const TABS: { id: TabId; label: string }[] = [
  { id: "users", label: "Drivers / Users" },
  { id: "stations", label: "Stations" },
  { id: "routes", label: "Routes" },
  { id: "timetables", label: "Timetables" },
  { id: "canned", label: "Canned Messages" },
  { id: "import", label: "Data Import" },
];

function KeyGate({ onUnlock }: { onUnlock: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string }>("/api/auth/admin", { method: "POST", body: { key } });
      setToken("admin", res.token);
      onUnlock();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm rounded-2xl border border-obu-line bg-obu-panel p-6 flex flex-col gap-4">
        <div>
          <div className="text-3xl font-black text-sky-400">C.O.R.E.</div>
          <div className="text-obu-dim">System Administration</div>
        </div>
        <label className="text-sm text-obu-dim">
          Administrator key / PIN
          <input className={`${inputCls} mt-1 text-lg`} type="password" autoFocus autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <ErrorBox message={error} />
        <button className={primaryCls} disabled={busy || !key}>
          Unlock
        </button>
      </form>
    </div>
  );
}

export function AdminApp() {
  const [unlocked, setUnlocked] = useState(() => !!getToken("admin"));
  const [tab, setTab] = useState<TabId>("users");

  if (!unlocked) return <KeyGate onUnlock={() => setUnlocked(true)} />;

  const logout = () => {
    setToken("admin", null);
    setUnlocked(false);
  };

  return (
    <div className="h-full flex flex-col bg-obu-bg">
      <header className="flex items-center gap-6 px-4 h-14 bg-obu-panel border-b border-obu-line shrink-0">
        <div className="text-xl font-black text-sky-400">C.O.R.E. Admin</div>
        <div className="flex-1" />
        <button className="rounded-lg border border-obu-line bg-obu-panel2 px-3 py-1.5 text-sm" onClick={logout}>
          Lock
        </button>
      </header>
      <nav className="flex gap-1 px-4 pt-3 border-b border-obu-line shrink-0 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2 font-bold whitespace-nowrap border border-b-0 ${tab === t.id ? "bg-obu-panel text-sky-400 border-obu-line" : "text-obu-dim border-transparent hover:text-obu-text"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto p-4">
        {tab === "users" && <UsersTab />}
        {tab === "stations" && <StationsTab />}
        {tab === "routes" && <RoutesTab />}
        {tab === "timetables" && <TimetablesTab />}
        {tab === "canned" && <CannedTab />}
        {tab === "import" && <ImportTab />}
      </main>
    </div>
  );
}
