import { useState } from "react";
import type { MessageTypeT } from "../lib/protocol";
import { clockHms } from "../lib/format";
import { useDash } from "./store";

const TYPE_STYLE: Record<MessageTypeT, string> = {
  STATUS: "bg-obu-line text-obu-text",
  DISPATCH_POPUP: "bg-amber/20 text-amber",
  PANIC: "bg-bad/20 text-bad",
};

export function MessageLog() {
  const messages = useDash((s) => s.messages);
  const [open, setOpen] = useState(true);
  const shown = messages.slice(0, 100);

  return (
    <section className="rounded border border-obu-line bg-obu-panel">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold hover:bg-obu-panel2"
      >
        <span>Message log ({shown.length})</span>
        <span className="text-obu-dim">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="max-h-60 divide-y divide-obu-line overflow-y-auto border-t border-obu-line text-sm">
          {shown.length === 0 && <li className="px-3 py-4 text-center text-obu-dim">No messages yet.</li>}
          {shown.map((m) => (
            <li key={m.id} className="flex items-start gap-3 px-3 py-1.5">
              <span className={`mt-0.5 w-32 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-semibold ${TYPE_STYLE[m.type]}`}>{m.type}</span>
              <span className="w-16 shrink-0 font-mono text-xs text-obu-dim">{clockHms(new Date(m.timestamp))}</span>
              <span className="w-40 shrink-0 truncate text-obu-dim" title={m.fromName}>
                {m.fromName}
              </span>
              <span className="min-w-0 flex-1 break-words">{m.content}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
