import { useState, type FormEvent } from "react";
import { api, setToken } from "../lib/api";
import { btnPrimary, Field, inputCls } from "./ui";

export interface DashUser {
  uid: number;
  forteId: string;
  name: string;
  role: string;
}

export function Login({ onLogin, notice }: { onLogin: (u: DashUser) => void; notice?: string }) {
  const [forteId, setForteId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(notice ?? null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ token: string; user: DashUser }>("/api/auth/login", { body: { forteId: forteId.trim(), pin: pin.trim() } });
      setToken("dash", res.token);
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-obu-bg p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-obu-line bg-obu-panel p-6">
        <div>
          <div className="text-xs font-semibold tracking-widest text-amber">C.O.R.E.</div>
          <h1 className="text-xl font-semibold">Dispatch Console</h1>
          <p className="text-xs text-obu-dim">Corporation Of Railway Engineering</p>
        </div>
        <Field label="Forte ID">
          <input className={inputCls} value={forteId} onChange={(e) => setForteId(e.target.value)} autoComplete="username" autoFocus required maxLength={16} />
        </Field>
        <Field label="PIN">
          <input
            className={inputCls}
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoComplete="current-password"
            required
            maxLength={16}
          />
        </Field>
        {error && (
          <p role="alert" className="rounded border border-bad bg-bad/10 px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !forteId || !pin} className={`${btnPrimary} w-full`}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
