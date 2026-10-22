import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import type { FleetRow } from "../lib/protocol";
import { useToasts } from "./ui";

interface TimetableOption {
  id: number;
  routeId: string;
  runNumber: string;
  label: string;
}

const input = "w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-2 text-obu-text";

export function ReliefModal({
  clients,
  defaultClientId,
  defaultRouteId,
  onClose,
}: {
  clients: FleetRow[];
  defaultClientId: string;
  defaultRouteId: string | null;
  onClose: () => void;
}) {
  const push = useToasts((s) => s.push);
  const [routeFilter, setRouteFilter] = useState(defaultRouteId ?? "");
  const [options, setOptions] = useState<TimetableOption[]>([]);
  const [baseId, setBaseId] = useState("");
  const [runNumber, setRunNumber] = useState("");
  const [shift, setShift] = useState("0");
  const [assignTo, setAssignTo] = useState(defaultClientId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = routeFilter ? `?routeId=${encodeURIComponent(routeFilter)}` : "";
    api<TimetableOption[]>(`/api/dispatch/timetables${q}`, { scope: "dash" })
      .then((rows) => {
        setOptions(rows);
        setBaseId("");
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load timetables"));
  }, [routeFilter]);

  const routeIds = [...new Set(options.map((o) => o.routeId).concat(routeFilter ? [routeFilter] : []))].sort();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ routeId: string; runNumber: string }>("/api/dispatch/relief", {
        method: "POST",
        scope: "dash",
        body: {
          baseTimetableId: Number(baseId),
          runNumber: runNumber.trim() || undefined,
          shiftMinutes: Number(shift) || 0,
          clientId: assignTo || undefined,
        },
      });
      push("ok", `Relief run ${res.routeId} / ${res.runNumber} created`);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-obu-line bg-obu-panel p-5 flex flex-col gap-3">
        <h2 className="text-lg font-bold">Inject relief / extra run</h2>
        <label className="text-sm text-obu-dim">
          Route filter
          <select className={input} value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
            <option value="">All routes</option>
            {routeIds.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-obu-dim">
          Base timetable (cloned)
          <select className={input} value={baseId} onChange={(e) => setBaseId(e.target.value)}>
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-obu-dim">
            Run number (optional)
            <input className={input} value={runNumber} maxLength={24} onChange={(e) => setRunNumber(e.target.value)} placeholder="auto (R001…)" />
          </label>
          <label className="text-sm text-obu-dim">
            Shift (minutes)
            <input className={input} type="number" value={shift} min={-720} max={720} onChange={(e) => setShift(e.target.value)} />
          </label>
        </div>
        <label className="text-sm text-obu-dim">
          Assign to client (optional)
          <select className={input} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Do not assign</option>
            {clients.map((c) => (
              <option key={c.clientId} value={c.clientId}>
                {c.deviceName || c.clientId} {c.driver ? `– ${c.driver.name}` : ""}
              </option>
            ))}
          </select>
        </label>
        {error && <div className="rounded-lg bg-bad/20 border border-bad text-bad px-3 py-2 text-sm">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="rounded-lg px-4 py-2 border border-obu-line bg-obu-panel2" onClick={onClose}>
            Cancel
          </button>
          <button className="rounded-lg px-4 py-2 bg-sky-500 text-black font-bold disabled:opacity-40" disabled={busy || !baseId} onClick={() => void submit()}>
            Create run
          </button>
        </div>
      </div>
    </div>
  );
}
