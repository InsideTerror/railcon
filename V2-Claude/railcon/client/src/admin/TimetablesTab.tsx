import { useState } from "react";
import { adminApi, btnCls, CrudTable, dangerCls, errText, ErrorBox, Field, inputCls, Modal, primaryCls, useList } from "./ui";

interface TtItem {
  id: number;
  routeId: string;
  runNumber: string;
  direction: number;
  isRelief: boolean;
  startTime: string;
  endTime: string;
  stopCount: number;
}
interface TtFull {
  id: number;
  routeId: string;
  runNumber: string;
  direction: number;
  stops: { index: number; stationId: number; name: string; arrival: string; departure: string }[];
}
interface Route {
  id: string;
  stops: { stationId: number }[];
}
interface Row {
  stationId: string;
  arrival: string;
  departure: string;
}
interface Draft {
  id?: number;
  routeId: string;
  runNumber: string;
  direction: 1 | 2;
  stops: Row[];
}

const TIME_RE = /^\d{1,3}:\d{2}(:\d{2})?$/;

export function TimetablesTab() {
  const [filter, setFilter] = useState("");
  const list = useList<TtItem>(`/api/admin/timetables${filter ? `?routeId=${encodeURIComponent(filter)}` : ""}`);
  const routes = useList<Route>("/api/admin/routes");
  const stations = useList<{ id: number; name: string }>("/api/admin/stations");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function edit(item: TtItem) {
    try {
      const full = await adminApi<TtFull>(`/api/admin/timetables/${item.id}`);
      setDraft({
        id: full.id,
        routeId: full.routeId,
        runNumber: full.runNumber,
        direction: full.direction === 2 ? 2 : 1,
        stops: full.stops.map((s) => ({ stationId: String(s.stationId), arrival: s.arrival, departure: s.departure })),
      });
      setFormError(null);
    } catch (e) {
      list.setError(errText(e));
    }
  }

  function loadFromRoute() {
    if (!draft) return;
    const route = routes.rows.find((r) => r.id === draft.routeId);
    if (!route) return;
    const ids = draft.direction === 2 ? [...route.stops].reverse() : route.stops;
    setDraft({ ...draft, stops: ids.map((s) => ({ stationId: String(s.stationId), arrival: "", departure: "" })) });
  }

  const setRow = (i: number, patch: Partial<Row>) => draft && setDraft({ ...draft, stops: draft.stops.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const moveRow = (i: number, d: -1 | 1) => {
    if (!draft) return;
    const j = i + d;
    if (j < 0 || j >= draft.stops.length) return;
    const next = [...draft.stops];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft({ ...draft, stops: next });
  };

  async function save() {
    if (!draft) return;
    setFormError(null);
    if (draft.stops.length < 2) return setFormError("A timetable needs at least 2 stops");
    for (const [i, r] of draft.stops.entries()) {
      if (!r.stationId) return setFormError(`Stop ${i + 1}: choose a station`);
      if (!TIME_RE.test(r.arrival) || !TIME_RE.test(r.departure)) return setFormError(`Stop ${i + 1}: times must be HH:MM or HH:MM:SS`);
    }
    const body = {
      routeId: draft.routeId,
      runNumber: draft.runNumber.trim(),
      direction: draft.direction,
      stops: draft.stops.map((r) => ({ stationId: Number(r.stationId), arrival: r.arrival, departure: r.departure })),
    };
    try {
      if (draft.id === undefined) await adminApi("/api/admin/timetables", "POST", body);
      else await adminApi(`/api/admin/timetables/${draft.id}`, "PUT", body);
      setDraft(null);
      await list.reload();
    } catch (e) {
      setFormError(errText(e));
    }
  }

  async function remove(t: TtItem) {
    if (!window.confirm(`Delete timetable ${t.routeId} / ${t.runNumber}?`)) return;
    try {
      await adminApi(`/api/admin/timetables/${t.id}`, "DELETE");
      await list.reload();
    } catch (e) {
      list.setError(errText(e));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center gap-3">
        <h2 className="text-lg font-bold">Timetables</h2>
        <div className="flex gap-2">
          <select className={`${inputCls} w-48`} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by route">
            <option value="">All routes</option>
            {routes.rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id}
              </option>
            ))}
          </select>
          <button
            className={primaryCls}
            disabled={routes.rows.length === 0}
            onClick={() => {
              setFormError(null);
              setDraft({ routeId: filter || routes.rows[0]?.id || "", runNumber: "", direction: 1, stops: [] });
            }}
          >
            + New timetable
          </button>
        </div>
      </div>
      <ErrorBox message={list.error ?? routes.error ?? stations.error} />
      <CrudTable
        rows={list.rows}
        rowKey={(t) => t.id}
        columns={[
          { header: "Route", render: (t) => <span className="font-mono font-bold">{t.routeId}</span> },
          { header: "Run", render: (t) => t.runNumber + (t.isRelief ? " (relief)" : "") },
          { header: "Dir", render: (t) => t.direction },
          { header: "Start", render: (t) => t.startTime },
          { header: "End", render: (t) => t.endTime },
          { header: "Stops", render: (t) => t.stopCount },
        ]}
        onEdit={(t) => void edit(t)}
        onDelete={(t) => void remove(t)}
      />
      {draft && (
        <Modal title={draft.id === undefined ? "New timetable" : `Edit timetable ${draft.routeId} / ${draft.runNumber}`} onClose={() => setDraft(null)} wide>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Route">
              <select className={inputCls} value={draft.routeId} onChange={(e) => setDraft({ ...draft, routeId: e.target.value })}>
                {routes.rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Run number">
              <input className={inputCls} value={draft.runNumber} maxLength={24} onChange={(e) => setDraft({ ...draft, runNumber: e.target.value })} />
            </Field>
            <Field label="Direction">
              <select className={inputCls} value={draft.direction} onChange={(e) => setDraft({ ...draft, direction: e.target.value === "2" ? 2 : 1 })}>
                <option value={1}>1 (outbound)</option>
                <option value={2}>2 (inbound)</option>
              </select>
            </Field>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm text-obu-dim">Stops (times HH:MM or HH:MM:SS; hours may exceed 24 after midnight)</div>
            <button className={btnCls} onClick={loadFromRoute} disabled={!draft.routeId}>
              Fill stations from route
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-[45vh] overflow-y-auto">
            {draft.stops.map((r, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_7rem_7rem_auto] gap-2 items-center">
                <span className="text-obu-dim font-mono">{i + 1}</span>
                <select className={inputCls} value={r.stationId} onChange={(e) => setRow(i, { stationId: e.target.value })} aria-label={`Station ${i + 1}`}>
                  <option value="">Station…</option>
                  {stations.rows.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input className={inputCls} placeholder="arr" value={r.arrival} onChange={(e) => setRow(i, { arrival: e.target.value })} aria-label={`Arrival ${i + 1}`} />
                <input className={inputCls} placeholder="dep" value={r.departure} onChange={(e) => setRow(i, { departure: e.target.value })} aria-label={`Departure ${i + 1}`} />
                <div className="flex gap-1">
                  <button className={btnCls} onClick={() => moveRow(i, -1)} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button className={btnCls} onClick={() => moveRow(i, 1)} disabled={i === draft.stops.length - 1} aria-label="Move down">
                    ↓
                  </button>
                  <button className={dangerCls} onClick={() => setDraft({ ...draft, stops: draft.stops.filter((_, k) => k !== i) })} aria-label="Remove">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button className={`${btnCls} self-start`} onClick={() => setDraft({ ...draft, stops: [...draft.stops, { stationId: "", arrival: "", departure: "" }] })}>
            + Add stop
          </button>
          <ErrorBox message={formError} />
          <div className="flex justify-end gap-2">
            <button className={btnCls} onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button className={primaryCls} disabled={!draft.routeId || !draft.runNumber.trim()} onClick={() => void save()}>
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
