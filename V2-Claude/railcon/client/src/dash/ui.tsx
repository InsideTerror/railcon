import { create } from "zustand";
import type { FleetRow } from "../lib/protocol";
import { signed } from "../lib/format";

interface ToastItem {
  id: number;
  level: "ok" | "err";
  text: string;
}
let seq = 1;
export const useToasts = create<{ items: ToastItem[]; push: (level: ToastItem["level"], text: string) => void }>((set) => ({
  items: [],
  push: (level, text) => {
    const id = seq++;
    set((s) => ({ items: [...s.items.slice(-4), { id, level, text }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 5000);
  },
}));

export function Toasts() {
  const items = useToasts((s) => s.items);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status">
      {items.map((t) => (
        <div key={t.id} className={`rounded-lg px-4 py-2 font-semibold shadow-lg ${t.level === "err" ? "bg-bad text-white" : "bg-ok text-black"}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function DelayBadge({ row }: { row: Pick<FleetRow, "delayMinutes" | "early" | "status"> }) {
  if (row.status !== "ACTIVE") return <span className="text-obu-dim">—</span>;
  let cls = "bg-ok text-black";
  let label = `${signed(row.delayMinutes)} min`;
  if (row.early) {
    cls = "bg-bad text-white";
    label = "EARLY";
  } else if (row.delayMinutes > 10) cls = "bg-bad text-white";
  else if (row.delayMinutes > 5) cls = "bg-amber text-black";
  else if (row.delayMinutes > 0) cls = "bg-warn text-black";
  return <span className={`inline-block rounded px-2 py-0.5 text-sm font-bold ${cls}`}>{label}</span>;
}
