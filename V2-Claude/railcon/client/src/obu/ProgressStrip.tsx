import { useEffect, useRef } from "react";
import { hm, signed } from "../lib/format";
import { useObu } from "./store";

function offsetChip(min: number) {
  const cls = min > 10 ? "bg-bad text-white" : min > 5 ? "bg-amber text-black" : min > 0 ? "bg-warn text-black" : "bg-ok text-black";
  return <span className={`px-2 rounded text-sm font-bold ${cls}`}>{signed(min)}</span>;
}

/** Left panel (40%): vertical timeline of stops. Grey = done, yellow = arrived (pending confirmation), white = current/next. */
export function ProgressStrip() {
  const session = useObu((s) => s.session);
  const run = session?.run;
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [session?.currentStopIndex, session?.phase, run?.timetableId]);

  if (!run || !session) {
    return (
      <div className="h-full flex items-center justify-center text-obu-dim text-xl p-6 text-center">
        No run selected.
        <br />
        Choose a run in Duty / Activity.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <div className="text-obu-dim text-sm mb-2">
        {run.routeName} · direction {run.direction}
        {run.isRelief ? " · RELIEF" : ""}
      </div>
      <div className="relative">
        {run.stops.map((s, i) => {
          const done = s.index < session.currentStopIndex;
          const active = s.index === session.currentStopIndex;
          const arrived = active && session.phase === "AT_STOP";
          const last = i === run.stops.length - 1;
          const isTerminal = s.index === run.terminalIndex;
          let box = "border-transparent text-obu-text";
          if (s.cancelled) box = "border-transparent text-obu-dim line-through";
          else if (done) box = "border-transparent text-obu-dim";
          else if (arrived) box = "bg-warn text-black border-warn font-bold";
          else if (active) box = "bg-white text-black border-white font-bold";
          const dot = s.cancelled ? "bg-obu-line" : done ? "bg-obu-dim" : arrived ? "bg-warn" : active ? "bg-white" : "bg-sky-500";
          return (
            <div key={s.index} ref={active ? activeRef : undefined} className="flex gap-3 items-stretch">
              <div className="flex flex-col items-center w-5 shrink-0">
                <div className={`w-4 h-4 rounded-full mt-4 ${dot}`} />
                {!last && <div className={`flex-1 w-1 ${done ? "bg-obu-dim" : "bg-sky-800"}`} />}
              </div>
              <div className={`flex-1 flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 my-0.5 ${box}`}>
                <div className="min-w-0">
                  <div className="text-xl truncate">{s.name}</div>
                  <div className={`text-sm ${active && !s.cancelled ? "text-black/70" : "text-obu-dim"}`}>
                    {s.cancelled ? "Not served" : isTerminal && run.terminalIndex < run.stops[run.stops.length - 1].index ? "Terminates here" : `arr ${hm(s.arr)}`}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="text-2xl font-mono tabular-nums">{hm(s.dep)}</div>
                  {s.offsetMin != null && !s.cancelled && offsetChip(s.offsetMin)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
