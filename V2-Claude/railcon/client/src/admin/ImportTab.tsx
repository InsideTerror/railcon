import { useState } from "react";
import { api } from "../lib/api";
import { btnCls, errText, ErrorBox, Field, inputCls, primaryCls } from "./ui";

interface Summary {
  source: "GTFS" | "CSV";
  routes: number;
  stations: number;
  timetables: number;
  stopTimes: number;
  warnings: string[];
}

const EXAMPLE = `RouteID,RunNumber,StationName,ScheduledArrival,ScheduledDeparture,SequenceIndex
S70,0101,Budapest-Nyugati,06:00,06:00,1
S70,0101,Újpest,06:12,06:13,2
S70,0101,Esztergom,07:05,07:05,3`;

function SummaryView({ s }: { s: Summary }) {
  return (
    <div className="rounded-lg border border-ok bg-ok/10 p-3 text-sm flex flex-col gap-1">
      <div className="font-bold text-ok">{s.source} import finished</div>
      <div>
        Routes: {s.routes} · Stations created/updated: {s.stations} · Timetables: {s.timetables} · Stop times: {s.stopTimes}
      </div>
      {s.warnings.length > 0 && (
        <details>
          <summary className="cursor-pointer text-amber">{s.warnings.length} warning(s)</summary>
          <ul className="list-disc ml-5 max-h-48 overflow-y-auto">
            {s.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function GtfsPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [maxTrips, setMaxTrips] = useState("");
  const [replace, setReplace] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Summary | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // The server reads the text fields from the stream before the file, so they MUST be appended first.
      const form = new FormData();
      if (serviceId.trim()) form.append("serviceId", serviceId.trim());
      if (maxTrips.trim()) form.append("maxTrips", maxTrips.trim());
      form.append("replace", String(replace));
      form.append("file", file);
      setResult(await api<Summary>("/api/admin/import/gtfs", { method: "POST", form, scope: "admin" }));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-obu-line bg-obu-panel p-4 flex flex-col gap-3">
      <h2 className="text-lg font-bold">GTFS zip</h2>
      <p className="text-sm text-obu-dim">Reads routes.txt, stops.txt, trips.txt and stop_times.txt. Stops of each trip are numbered 1..N in stop_sequence order.</p>
      <Field label="GTFS .zip file">
        <input type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="service_id filter (optional)">
          <input className={inputCls} value={serviceId} onChange={(e) => setServiceId(e.target.value)} />
        </Field>
        <Field label="Max trips (optional, default 5000)">
          <input className={inputCls} inputMode="numeric" value={maxTrips} onChange={(e) => setMaxTrips(e.target.value.replace(/\D/g, ""))} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace existing timetables of the imported routes
      </label>
      <ErrorBox message={error} />
      {result && <SummaryView s={result} />}
      <button className={`${primaryCls} self-start`} disabled={!file || busy} onClick={() => void upload()}>
        {busy ? "Importing…" : "Import GTFS"}
      </button>
    </section>
  );
}

function CsvPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Summary | null>(null);

  async function upload() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (file) {
        const form = new FormData();
        form.append("file", file);
        setResult(await api<Summary>("/api/admin/import/csv", { method: "POST", form, scope: "admin" }));
      } else {
        setResult(await api<Summary>("/api/admin/import/csv", { method: "POST", body: { text }, scope: "admin" }));
      }
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-obu-line bg-obu-panel p-4 flex flex-col gap-3">
      <h2 className="text-lg font-bold">Custom CSV</h2>
      <div className="rounded-lg bg-obu-bg border border-obu-line p-3 text-sm">
        <div className="text-obu-dim mb-1">
          Columns: <code className="text-obu-text">RouteID, RunNumber, StationName, ScheduledArrival, ScheduledDeparture, SequenceIndex</code>. Times are HH:MM or HH:MM:SS. A header row is optional. Existing runs with the same RouteID + RunNumber are replaced.
        </div>
        <pre className="font-mono text-xs overflow-x-auto">{EXAMPLE}</pre>
        <button className={`${btnCls} mt-2`} onClick={() => setText(EXAMPLE)}>
          Use example
        </button>
      </div>
      <Field label="CSV file (optional - overrides the text below)">
        <input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={inputCls} />
      </Field>
      <Field label="…or paste CSV text">
        <textarea className={`${inputCls} font-mono text-xs`} rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <ErrorBox message={error} />
      {result && <SummaryView s={result} />}
      <button className={`${primaryCls} self-start`} disabled={busy || (!file && !text.trim())} onClick={() => void upload()}>
        {busy ? "Importing…" : "Import CSV"}
      </button>
    </section>
  );
}

export function ImportTab() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
      <GtfsPanel />
      <CsvPanel />
    </div>
  );
}
