import { timeAgo } from "../lib/format";
import type { FleetRow } from "../lib/protocol";
import { DelayBadge } from "./ui";

interface Props {
  rows: FleetRow[];
  selectedId: string | null;
  onSelect: (clientId: string) => void;
}

const th = "text-left text-xs uppercase tracking-wide text-obu-dim font-semibold px-3 py-2 whitespace-nowrap";
const td = "px-3 py-2 align-middle";

export function FleetTable({ rows, selectedId, onSelect }: Props) {
  const sorted = [...rows].sort((a, b) => Number(b.panic) - Number(a.panic) || (a.routeId ?? "~").localeCompare(b.routeId ?? "~") || a.deviceName.localeCompare(b.deviceName));
  if (sorted.length === 0) return <div className="p-8 text-center text-obu-dim">No clients in this category.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-obu-panel sticky top-0">
          <tr>
            <th className={th}>Device</th>
            <th className={th}>Driver</th>
            <th className={th}>Route / Run</th>
            <th className={th}>Dir</th>
            <th className={th}>Current → Next</th>
            <th className={th}>Terminal</th>
            <th className={th}>Delay</th>
            <th className={th}>Phase</th>
            <th className={th}>Advisories</th>
            <th className={th}>Seen</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.clientId}
              onClick={() => onSelect(r.clientId)}
              className={`cursor-pointer border-t border-obu-line ${
                r.panic ? "bg-bad/30 animate-pulse" : r.clientId === selectedId ? "bg-sky-900/50" : "hover:bg-obu-panel2"
              }`}
            >
              <td className={td}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${r.online ? "bg-ok" : "bg-obu-dim"}`} title={r.online ? "Online" : "Offline"} />
                <span className="font-semibold">{r.deviceName || r.clientId}</span>
                {r.panic && <span className="ml-2 text-xs bg-bad text-white rounded px-1.5 py-0.5 font-bold">PANIC</span>}
              </td>
              <td className={td}>{r.driver ? `${r.driver.name} (${r.driver.forteId})` : <span className="text-obu-dim">—</span>}</td>
              <td className={`${td} font-mono`}>{r.routeId ? `${r.routeId} / ${r.runNumber}` : <span className="text-obu-dim">—</span>}</td>
              <td className={td}>{r.direction ?? "—"}</td>
              <td className={td}>
                {r.currentStopName ? (
                  <>
                    {r.currentStopName}
                    {r.nextStopName && <span className="text-obu-dim"> → {r.nextStopName}</span>}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className={td}>
                {r.terminalName ?? "—"}
                {r.truncated && <span className="ml-2 text-xs bg-amber text-black rounded px-1.5 py-0.5 font-bold">TRUNCATED</span>}
              </td>
              <td className={td}>
                <DelayBadge row={r} />
              </td>
              <td className={td}>{r.status === "ACTIVE" ? (r.phase === "AT_STOP" ? (r.doorsOpen ? "At stop, doors open" : "At stop") : "En route") : "—"}</td>
              <td className={td}>
                <div className="flex flex-wrap gap-1">
                  {r.advisories.map((a) => (
                    <span key={a.id} className={`rounded px-2 py-0.5 text-xs font-bold ${a.kind === "HOLD" ? "bg-warn text-black" : "bg-bad text-white"}`}>
                      {a.text}
                    </span>
                  ))}
                </div>
              </td>
              <td className={`${td} text-obu-dim whitespace-nowrap`}>{r.online ? "online" : timeAgo(r.lastSeen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
