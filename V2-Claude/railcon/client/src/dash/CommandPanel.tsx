import { useState } from "react";
import { api, ApiError } from "../lib/api";
import type { FleetRow } from "../lib/protocol";
import { ReliefModal } from "./ReliefModal";
import { useToasts } from "./ui";

const input = "w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-2 text-obu-text";
const btn = "rounded-lg px-3 py-2 text-sm font-semibold border border-obu-line bg-obu-panel2 hover:bg-sky-900 disabled:opacity-40";
const danger = "rounded-lg px-3 py-2 text-sm font-semibold bg-bad/80 hover:bg-bad text-white disabled:opacity-40";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-obu-line pt-3">
      <h3 className="text-sm font-bold text-sky-400 mb-2">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function CommandPanel({ row, allRows, onClose }: { row: FleetRow; allRows: FleetRow[]; onClose: () => void }) {
  const push = useToasts((s) => s.push);
  const [busy, setBusy] = useState(false);
  const [truncAt, setTruncAt] = useState("");
  const [mode, setMode] = useState<"DELAY" | "SHIFT">("DELAY");
  const [minutes, setMinutes] = useState("0");
  const [popup, setPopup] = useState("");
  const [relief, setRelief] = useState(false);

  const remaining = row.stops.filter((s) => s.index >= row.currentStopIndex && !s.cancelled);
  const lastIndex = row.stops.length ? row.stops[row.stops.length - 1].index : 0;
  const hasRun = row.status === "ACTIVE" || row.timetableId != null;

  async function run(label: string, path: string, body: unknown, after?: () => void) {
    setBusy(true);
    try {
      await api(path, { method: "POST", body, scope: "dash" });
      push("ok", label);
      after?.();
    } catch (e) {
      push("err", e instanceof ApiError ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const base = `/api/dispatch/clients/${encodeURIComponent(row.clientId)}`;
  const confirmThen = (msg: string, fn: () => void) => () => {
    if (window.confirm(msg)) fn();
  };

  return (
    <aside className="w-[380px] shrink-0 border-l border-obu-line bg-obu-panel overflow-y-auto p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold">{row.deviceName || row.clientId}</div>
          <div className="text-sm text-obu-dim">
            {row.driver ? `${row.driver.name} (${row.driver.forteId})` : "No driver"} · {row.routeId ? `${row.routeId} / ${row.runNumber}` : "No run"}
          </div>
        </div>
        <button className={btn} onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>

      <Section title="Truncate / cancel stops">
        <select className={input} value={truncAt} onChange={(e) => setTruncAt(e.target.value)} disabled={!hasRun}>
          <option value="">Terminate run at…</option>
          {remaining.map((s) => (
            <option key={s.index} value={s.index}>
              {s.index}. {s.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            className={btn}
            disabled={busy || !truncAt}
            onClick={confirmThen("Remove all stops after the selected one?", () => void run("Run truncated", `${base}/truncate`, { afterStopIndex: Number(truncAt) }, () => setTruncAt("")))}
          >
            Truncate run
          </button>
          <button className={btn} disabled={busy || !hasRun || !row.truncated} onClick={() => void run("Full run restored", `${base}/truncate`, { afterStopIndex: lastIndex })}>
            Restore full run
          </button>
        </div>
      </Section>

      <Section title="Schedule override">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "DELAY"} onChange={() => setMode("DELAY")} /> Set displayed offset
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "SHIFT"} onChange={() => setMode("SHIFT")} /> Shift remaining timetable
          </label>
        </div>
        <div className="flex gap-2">
          <input className={input} type="number" step={1} min={-240} max={240} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" />
          <button
            className={btn}
            disabled={busy || !hasRun || minutes === "" || !Number.isFinite(Number(minutes))}
            onClick={() => void run("Schedule override applied", `${base}/override`, { mode, minutes: Number(minutes) })}
          >
            Apply
          </button>
        </div>
      </Section>

      <Section title="Pop-up message (shown 10 s on the OBU)">
        <textarea className={input} rows={3} maxLength={300} value={popup} onChange={(e) => setPopup(e.target.value)} placeholder="Message text…" />
        <div className="flex gap-2">
          <button
            className={btn}
            disabled={busy || !popup.trim()}
            onClick={() => void run("Pop-up sent", "/api/dispatch/popup", { clientIds: [row.clientId], content: popup.trim() }, () => setPopup(""))}
          >
            Send to this client
          </button>
          <button
            className={btn}
            disabled={busy || !popup.trim()}
            onClick={confirmThen("Broadcast this pop-up to ALL online clients?", () => void run("Pop-up broadcast to all online clients", "/api/dispatch/popup", { clientIds: "ALL", content: popup.trim() }, () => setPopup("")))}
          >
            Broadcast to ALL online
          </button>
        </div>
      </Section>

      <Section title="Relief runs">
        <button className={btn} onClick={() => setRelief(true)}>
          Inject relief / extra run…
        </button>
      </Section>

      <Section title="Remote session terminate">
        <div className="flex flex-wrap gap-2">
          <button className={danger} disabled={busy || !row.driver} onClick={confirmThen("Log out the driver on this device?", () => void run("Driver logged out", `${base}/terminate`, { target: "DRIVER" }))}>
            Log out driver
          </button>
          <button className={danger} disabled={busy || !row.timetableId} onClick={confirmThen("End the route on this device?", () => void run("Route ended", `${base}/terminate`, { target: "ROUTE" }))}>
            End route
          </button>
          <button className={danger} disabled={busy} onClick={confirmThen("Terminate driver AND route on this device?", () => void run("Session terminated", `${base}/terminate`, { target: "BOTH" }))}>
            Terminate both
          </button>
        </div>
      </Section>

      {relief && <ReliefModal defaultClientId={row.clientId} defaultRouteId={row.routeId} clients={allRows.filter((r) => r.online)} onClose={() => setRelief(false)} />}
    </aside>
  );
}
