import { useState } from "react";
import { api } from "../lib/api";
import { call } from "./toast";
import { btnPrimary, inputCls } from "./ui";

export function PopupForm({ clientIds, submitLabel, confirmText, onSent }: { clientIds: string[] | "ALL"; submitLabel: string; confirmText?: string; onSent?: () => void }) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    const res = await call(() => api("/api/dispatch/popup", { scope: "dash", body: { clientIds, content: content.trim() } }), "Pop-up sent");
    setBusy(false);
    if (res) {
      setContent("");
      onSent?.();
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        className={`${inputCls} h-20 resize-none`}
        aria-label="Pop-up text"
        maxLength={300}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Message to display on the OBU"
      />
      <div className="flex items-center justify-between text-xs text-obu-dim">
        <span>Pop-ups are shown for 10 seconds on the OBU.</span>
        <span>{content.length}/300</span>
      </div>
      <button type="button" className={btnPrimary} disabled={busy || content.trim().length === 0} onClick={() => void send()}>
        {submitLabel}
      </button>
    </div>
  );
}
