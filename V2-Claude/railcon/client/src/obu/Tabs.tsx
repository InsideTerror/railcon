import { useEffect, useState } from "react";
import { DEFAULT_SERVER, deviceName, PIS_PORT, clientId, serverBase, setDeviceName, setServerBase } from "../lib/config";
import { hm, timeAgo } from "../lib/format";
import { probeLatency, useObu } from "./store";

const btn = "rounded-xl border border-obu-line bg-obu-panel2 active:bg-sky-900 font-semibold";

// ------------------------------------------------------------------ Duty / Activity
export function DutyTab() {
  const { session, runs, send } = useObu();
  const [fuel, setFuel] = useState("");
  const [km, setKm] = useState("");
  const [note, setNote] = useState("");
  const run = session?.run;
  const canChange = !run || (session!.currentStopIndex === 1 && session!.phase === "RUNNING");

  useEffect(() => {
    send({ t: "runs.list" });
  }, [send, run?.timetableId]);

  const saveLog = () => {
    const f = fuel ? Number(fuel) : undefined;
    const m = km ? Number(km) : undefined;
    if ((f !== undefined && !Number.isFinite(f)) || (m !== undefined && !Number.isFinite(m))) return;
    if (f === undefined && m === undefined && !note) return;
    send({ t: "duty.log", fuelLiters: f, mileageKm: m, note });
    setFuel("");
    setKm("");
    setNote("");
  };

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-5">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold">{run ? "Current run" : "Select a run"}</h2>
          <button className={`${btn} px-4 py-2 text-sm`} onClick={() => send({ t: "runs.list" })}>
            Refresh
          </button>
        </div>
        {run && (
          <div className="rounded-xl border-2 border-sky-500 bg-obu-panel2 p-4 flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">
                {run.routeId} / {run.runNumber}
              </div>
              <div className="text-obu-dim">
                {run.stops[0]?.name} → {run.stops.find((s) => s.index === run.terminalIndex)?.name}
              </div>
            </div>
            <button className="rounded-xl bg-bad/80 px-5 py-3 font-bold active:bg-bad" onClick={() => send({ t: "run.end" })}>
              End run
            </button>
          </div>
        )}
        {canChange && (
          <div className="grid grid-cols-1 gap-2 mt-2">
            {runs.length === 0 && <div className="text-obu-dim py-4">No runs available right now.</div>}
            {runs.map((r) => (
              <button
                key={r.timetableId}
                onClick={() => send({ t: "run.select", timetableId: r.timetableId })}
                className={`${btn} px-4 py-3 text-left flex items-center justify-between ${r.assigned ? "border-sky-400" : ""}`}
              >
                <span>
                  <span className="text-xl font-bold">
                    {r.routeId} / {r.runNumber}
                  </span>
                  {r.isRelief && <span className="ml-2 text-xs bg-amber text-black rounded px-2 py-0.5">RELIEF</span>}
                  {r.assigned && <span className="ml-2 text-xs bg-sky-400 text-black rounded px-2 py-0.5">ASSIGNED</span>}
                  <span className="block text-obu-dim text-sm">
                    {r.from} → {r.to}
                  </span>
                </span>
                <span className="font-mono text-lg">
                  {hm(r.startTime)}–{hm(r.endTime)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-obu-line p-4 bg-obu-panel">
        <h2 className="text-xl font-bold mb-3">Fuel / mileage entry</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-obu-dim">
            Fuel (litres)
            <input inputMode="decimal" value={fuel} onChange={(e) => setFuel(e.target.value)} className="mt-1 w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-3 text-xl text-obu-text" />
          </label>
          <label className="text-sm text-obu-dim">
            Mileage (km)
            <input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} className="mt-1 w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-3 text-xl text-obu-text" />
          </label>
          <label className="text-sm text-obu-dim col-span-2">
            Note
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-3 text-xl text-obu-text" />
          </label>
        </div>
        <button className={`${btn} mt-3 px-6 py-3`} onClick={saveLog}>
          Save entry
        </button>
      </section>

      <button
        className="rounded-xl bg-obu-panel2 border border-bad text-bad px-6 py-4 text-xl font-bold active:bg-bad/30 self-start"
        onClick={() => {
          if (confirm("Log out and end the current duty?")) send({ t: "logout" });
        }}
      >
        Log out
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ Send Message
export function MessageTab() {
  const { canned, send } = useObu();
  const options = canned.filter((c) => c.category === "DRIVER_TO_DISPATCH");
  const [sentId, setSentId] = useState<number | null>(null);
  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="text-xl font-bold mb-3">Message to dispatch</h2>
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              send({ t: "message.send", optionId: o.id });
              setSentId(o.id);
              setTimeout(() => setSentId(null), 1500);
            }}
            className={`${btn} min-h-[88px] px-3 py-3 text-left ${sentId === o.id ? "bg-ok text-black" : ""}`}
          >
            <div className="text-lg leading-tight">{sentId === o.id ? "✓ Sent" : o.label}</div>
            <div className={`text-xs font-normal mt-1 ${sentId === o.id ? "text-black/70" : "text-obu-dim"}`}>{o.templateText}</div>
          </button>
        ))}
        {options.length === 0 && <div className="text-obu-dim col-span-2">No messages loaded yet - waiting for the server.</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Announcements
export function AnnounceTab() {
  const { canned, announce, pisConnected } = useObu();
  const options = canned.filter((c) => c.category === "PASSENGER_ANNOUNCEMENT");
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold">Passenger announcements</h2>
        <span className={`text-xs px-2 py-1 rounded ${pisConnected ? "bg-ok/20 text-ok" : "bg-amber/20 text-amber"}`}>
          {pisConnected ? "Playing on PIS display" : "PIS offline - speaking on this device"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              announce(o.id, o.templateText);
              setLast(o.label);
              setTimeout(() => setLast(null), 2000);
            }}
            className={`${btn} min-h-[88px] px-3 py-3 text-left ${last === o.label ? "bg-sky-600" : ""}`}
          >
            <div className="text-lg leading-tight">🔊 {o.label}</div>
            <div className="text-xs font-normal text-obu-dim mt-1">“{o.templateText}”</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Settings
export function SettingsTab() {
  const { brightness, setBrightness, connected, pisConnected, latencyMs, gpsFix, gpsSupported, send, session } = useObu();
  const [url, setUrl] = useState(serverBase());
  const [name, setName] = useState(deviceName());
  const [ips, setIps] = useState<string[]>([]);
  useEffect(() => {
    const native = (window as unknown as { coreNative?: { getLocalIps: () => Promise<string[]> } }).coreNative;
    native?.getLocalIps().then(setIps).catch(() => {});
    probeLatency();
  }, []);

  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between py-1.5 border-b border-obu-line/50">
      <span className="text-obu-dim">{k}</span>
      <span className="font-mono text-right">{v}</span>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-5">
      <section className="rounded-xl border border-obu-line bg-obu-panel p-4">
        <h2 className="text-xl font-bold mb-2">Display brightness</h2>
        <input type="range" min={0.3} max={1} step={0.05} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full h-10" />
        <div className="text-xs text-obu-dim">Software dimming only; hardware backlight is controlled by the device.</div>
      </section>

      <section className="rounded-xl border border-obu-line bg-obu-panel p-4">
        <h2 className="text-xl font-bold mb-2">System diagnostics</h2>
        {row("Server link", connected ? <span className="text-ok">connected</span> : <span className="text-bad">offline</span>)}
        {row("Latency", latencyMs != null ? `${latencyMs} ms` : "—")}
        {row("GPS", gpsSupported ? (gpsFix ? <span className="text-ok">fix</span> : "no fix") : "not available")}
        {row("PIS sub-server", pisConnected ? <span className="text-ok">running</span> : <span className="text-amber">not running</span>)}
        {row("Client ID", clientId())}
        {row("Server", serverBase())}
        {row("PIS display", ips.length ? ips.map((ip) => `http://${ip}:${PIS_PORT}/passenger-display`).join("  ") : `http://<this-device-ip>:${PIS_PORT}/passenger-display`)}
        {row("Session", session ? session.status : "—")}
        <div className="flex gap-3 mt-3">
          <button className={`${btn} px-4 py-3`} onClick={probeLatency}>
            Test link
          </button>
          <button
            className={`${btn} px-4 py-3`}
            onClick={() => {
              send({ t: "runs.list" });
              send({ t: "inbox.list" });
            }}
          >
            Sync data
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-obu-line bg-obu-panel p-4">
        <h2 className="text-xl font-bold mb-2">Device</h2>
        <label className="text-sm text-obu-dim">
          Device name
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-3 text-lg text-obu-text" />
        </label>
        <label className="text-sm text-obu-dim block mt-3">
          Server URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={DEFAULT_SERVER} className="mt-1 w-full rounded-lg bg-obu-bg border border-obu-line px-3 py-3 text-lg text-obu-text" />
        </label>
        <button
          className={`${btn} mt-3 px-5 py-3`}
          onClick={() => {
            setDeviceName(name);
            setServerBase(url);
            location.reload();
          }}
        >
          Save &amp; reconnect
        </button>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ Inbox
export function InboxTab() {
  const { inbox, send } = useObu();
  useEffect(() => {
    send({ t: "inbox.list" });
  }, [send]);
  const unread = inbox.filter((m) => !m.acknowledged).map((m) => m.id);
  useEffect(() => {
    if (unread.length) {
      const t = setTimeout(() => send({ t: "ack", messageIds: unread }), 2500);
      return () => clearTimeout(t);
    }
  }, [unread.join(","), send]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-2">
      <h2 className="text-xl font-bold mb-1">Inbox</h2>
      {inbox.length === 0 && <div className="text-obu-dim py-4">No messages.</div>}
      {inbox.map((m) => (
        <div key={m.id} className={`rounded-xl border p-3 ${m.acknowledged ? "border-obu-line bg-obu-panel" : "border-sky-400 bg-obu-panel2"}`}>
          <div className="flex justify-between text-sm text-obu-dim">
            <span>{m.fromName}</span>
            <span>{new Date(m.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {timeAgo(new Date(m.timestamp).getTime())}</span>
          </div>
          <div className="text-lg mt-1">{m.content}</div>
        </div>
      ))}
    </div>
  );
}
