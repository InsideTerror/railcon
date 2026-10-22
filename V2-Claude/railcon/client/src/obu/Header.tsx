import { useEffect, useState } from "react";
import { clockHms, signed } from "../lib/format";
import { useObu } from "./store";

/** Schedule offset badge: green <=0, yellow 1-5, amber 6-10 (spec gap, documented), red >10 or EARLY. */
export function OffsetBadge({ minutes, early, className = "" }: { minutes: number; early: boolean; className?: string }) {
  let cls = "bg-ok text-black";
  let label = signed(minutes) + " min";
  if (early) {
    cls = "bg-bad text-white animate-pulse";
    label = "EARLY!";
  } else if (minutes > 10) cls = "bg-bad text-white";
  else if (minutes > 5) cls = "bg-amber text-black";
  else if (minutes > 0) cls = "bg-warn text-black";
  return <div className={`rounded-lg px-4 py-1 font-black text-center leading-tight ${cls} ${className}`}>{label}</div>;
}

function Clock() {
  const offset = useObu((s) => s.clockOffsetMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return <div className="font-mono text-3xl font-bold tabular-nums">{clockHms(new Date(now + offset))}</div>;
}

export function Header() {
  const { session, connected, gpsFix, gpsSupported } = useObu();
  const run = session?.run;
  return (
    <header className="flex items-center gap-6 px-5 h-[72px] bg-obu-panel border-b border-obu-line shrink-0">
      <div className="min-w-[200px]">
        <div className="text-xl font-bold leading-tight">{session?.driver?.name ?? "—"}</div>
        <div className="text-obu-dim text-sm">Driver ID {session?.driver?.forteId ?? "—"}</div>
      </div>
      <div className="min-w-[160px]">
        <div className="text-obu-dim text-sm">Route / Run</div>
        <div className="text-xl font-bold">{run ? `${run.routeId} / ${run.runNumber}` : "No run"}</div>
      </div>
      <div className="flex items-center gap-2 flex-1">
        <span className={`px-3 py-1 rounded-md text-sm font-bold ${connected ? "bg-ok/20 text-ok border border-ok" : "bg-bad/20 text-bad border border-bad animate-pulse"}`}>
          {connected ? "GSM/DATA" : "NO DATA"}
        </span>
        <span
          className={`px-3 py-1 rounded-md text-sm font-bold border ${
            gpsFix ? "bg-ok/20 text-ok border-ok" : "bg-obu-panel2 text-obu-dim border-obu-line"
          }`}
          title={gpsSupported ? (gpsFix ? "GPS fix" : "Waiting for GPS fix") : "GPS not available on this device"}
        >
          ◎ GPS
        </span>
      </div>
      {run && session ? <OffsetBadge minutes={session.delayMinutes} early={session.early} className="text-2xl min-w-[130px]" /> : null}
      <Clock />
    </header>
  );
}
