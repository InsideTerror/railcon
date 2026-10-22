import { api } from "../lib/api";
import { clockHms } from "../lib/format";
import { useDash } from "./store";
import { call } from "./toast";
import { btnDanger, btnGhost } from "./ui";

export function PanicBanner() {
  const messages = useDash((s) => s.messages);
  const fleet = useDash((s) => s.fleet);
  const select = useDash((s) => s.select);
  const panics = messages.filter((m) => m.type === "PANIC" && !m.acknowledged);
  if (panics.length === 0) return null;

  const ack = (id: number) => call(() => api(`/api/dispatch/messages/${id}/ack`, { method: "POST", scope: "dash" }), "Panic acknowledged");

  return (
    <div className="space-y-1 border-b border-bad bg-bad/20 px-4 py-2" role="alert">
      {panics.map((m) => (
        <div key={m.id} className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-bad px-2 py-0.5 text-xs font-bold tracking-wider text-white">PANIC</span>
          <span className="text-sm font-semibold">{m.fromName}</span>
          {m.routeRun && <span className="font-mono text-xs text-obu-dim">{m.routeRun}</span>}
          <span className="text-sm">{m.content}</span>
          <span className="text-xs text-obu-dim">{clockHms(new Date(m.timestamp))}</span>
          <span className="ml-auto flex gap-2">
            {m.fromClientId && fleet[m.fromClientId] && (
              <button type="button" className={btnGhost} onClick={() => select(m.fromClientId)}>
                Locate
              </button>
            )}
            <button type="button" className={btnDanger} onClick={() => void ack(m.id)}>
              Acknowledge
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
