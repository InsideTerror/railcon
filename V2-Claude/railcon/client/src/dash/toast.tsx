import { create } from "zustand";
import { ApiError } from "../lib/api";

interface Toast {
  id: number;
  kind: "ok" | "err";
  text: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: Toast["kind"], text: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push: (kind, text) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === "err" ? 7000 : 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const UNAUTH_EVENT = "core:dash-unauth";

/** Runs a REST call, toasting success/failure. Returns null on failure. A 401 signals the app to return to login. */
export async function call<T>(fn: () => Promise<T>, okText?: string): Promise<T | null> {
  try {
    const result = await fn();
    if (okText) useToasts.getState().push("ok", okText);
    return result;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) window.dispatchEvent(new Event(UNAUTH_EVENT));
    useToasts.getState().push("err", e instanceof Error ? e.message : "Request failed");
    return null;
  }
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "err" ? "alert" : "status"}
          className={`pointer-events-auto flex items-start justify-between gap-2 rounded border px-3 py-2 text-sm shadow-lg ${
            t.kind === "err" ? "border-bad bg-bad/15 text-bad" : "border-ok bg-ok/15 text-ok"
          }`}
        >
          <span className="text-obu-text">{t.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-obu-dim hover:text-obu-text">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
