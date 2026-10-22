export type AppMode = "obu" | "dash" | "admin";

export const DEFAULT_SERVER = "https://railcon.corerail.dpdns.org";

export function detectMode(): AppMode {
  const p = location.pathname;
  const q = new URLSearchParams(location.search).get("mode");
  if (q === "dash" || q === "admin" || q === "obu") return q;
  if (p.startsWith("/admin")) return "admin";
  if (p.startsWith("/dash")) return "dash";
  if (location.hostname.toLowerCase().startsWith("dash.")) return "dash";
  return "obu";
}

/** True when the UI is hosted by the C.O.R.E. server itself (browser/PWA), false inside Electron/Capacitor. */
export function isHostedBySameServer(): boolean {
  return location.protocol.startsWith("http") && location.hostname !== "localhost" ? true : location.port === "3000" || location.port === "5173";
}

/** Base URL of the central server (no trailing slash). User-configurable on the OBU Settings tab. */
export function serverBase(): string {
  const saved = localStorage.getItem("core.serverUrl");
  if (saved) return saved.replace(/\/+$/, "");
  const env = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SERVER_URL;
  if (env) return env.replace(/\/+$/, "");
  if (isHostedBySameServer()) return location.origin;
  return DEFAULT_SERVER;
}

export function setServerBase(url: string) {
  if (url.trim()) localStorage.setItem("core.serverUrl", url.trim());
  else localStorage.removeItem("core.serverUrl");
}

export function toWsBase(httpBase: string): string {
  return httpBase.replace(/^http/i, "ws");
}

/** Stable per-device identity. */
export function clientId(): string {
  let id = localStorage.getItem("core.clientId");
  if (!id) {
    id = "obu-" + (crypto.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10));
    localStorage.setItem("core.clientId", id);
  }
  return id;
}

export function deviceName(): string {
  return localStorage.getItem("core.deviceName") || clientId();
}
export function setDeviceName(name: string) {
  localStorage.setItem("core.deviceName", name.trim());
}

export const PIS_PORT = 8080;
