import { create } from "zustand";
import { ReconnectingSocket } from "../lib/socket";
import { clientId, deviceName, PIS_PORT, serverBase, toWsBase } from "../lib/config";
import type { CannedOptionDto, InboxMessageDto, ObuToServer, RunListItem, ServerToObu, SessionDto } from "../lib/protocol";

export interface Toast {
  id: number;
  level: "info" | "error";
  text: string;
}
export interface Popup {
  id: number;
  text: string;
  from: string;
  until: number;
}

interface ObuState {
  connected: boolean;
  pisConnected: boolean;
  latencyMs: number | null;
  session: SessionDto | null;
  canned: CannedOptionDto[];
  inbox: InboxMessageDto[];
  runs: RunListItem[];
  toasts: Toast[];
  popup: Popup | null;
  loginError: string | null;
  panicActive: boolean;
  gpsFix: boolean;
  gpsSupported: boolean;
  brightness: number; // 0.3 - 1
  clockOffsetMs: number;
  start: () => void;
  stop: () => void;
  send: (m: ObuToServer) => void;
  dismissPopup: () => void;
  pushToast: (level: Toast["level"], text: string) => void;
  setBrightness: (b: number) => void;
  announce: (id: number | undefined, text: string) => void;
}

let sock: ReconnectingSocket<ServerToObu, ObuToServer> | null = null;
let pis: ReconnectingSocket<unknown, unknown> | null = null;
let pingSentAt = 0;
let toastSeq = 1;
let geoWatch: number | null = null;
let geofencedIndex = -1;
const GEOFENCE_M = 300;

function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pisSend(frame: unknown): boolean {
  return pis?.send(frame) ?? false;
}

function pisState(s: SessionDto | null) {
  const run = s?.run ?? null;
  const terminal = run ? run.stops.find((x) => x.index === run.terminalIndex) : undefined;
  return {
    t: "state",
    state: {
      active: !!(s?.driver && run),
      routeId: run?.routeId ?? null,
      routeName: run?.routeName ?? null,
      runNumber: run?.runNumber ?? null,
      destination: terminal?.name ?? null,
      currentStopIndex: s?.currentStopIndex ?? 1,
      phase: s?.phase ?? "RUNNING",
      doorsOpen: s?.doorsOpen ?? false,
      terminalIndex: run?.terminalIndex ?? null,
      delayMinutes: s?.delayMinutes ?? 0,
      early: s?.early ?? false,
      stops: (run?.stops ?? []).map((x) => ({ index: x.index, name: x.name, arr: x.arr, dep: x.dep, cancelled: x.cancelled })),
      advisories: (s?.advisories ?? []).map((a) => ({ kind: a.kind, text: a.text })),
      serverNowSec: s?.serverNowSec ?? 0,
      sentAtMs: Date.now(),
    },
  };
}

function speakLocal(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    speechSynthesis.speak(u);
  } catch {
    /* no TTS on this platform */
  }
}

export const useObu = create<ObuState>((set, get) => ({
  connected: false,
  pisConnected: false,
  latencyMs: null,
  session: null,
  canned: [],
  inbox: [],
  runs: [],
  toasts: [],
  popup: null,
  loginError: null,
  panicActive: false,
  gpsFix: false,
  gpsSupported: typeof navigator !== "undefined" && "geolocation" in navigator,
  brightness: Number(localStorage.getItem("core.brightness") ?? 1) || 1,
  clockOffsetMs: 0,

  pushToast: (level, text) => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, level, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },

  setBrightness: (b) => {
    localStorage.setItem("core.brightness", String(b));
    set({ brightness: b });
  },

  send: (m) => {
    if (!sock?.send(m)) get().pushToast("error", "No connection to the server - action not sent.");
  },

  dismissPopup: () => set({ popup: null }),

  announce: (id, text) => {
    get().send({ t: "announce", optionId: id, text });
    if (!pisSend({ t: "announce", id: id ?? 0, text })) speakLocal(text);
  },

  start: () => {
    if (sock) return;
    const url = () => `${toWsBase(serverBase())}/ws/obu?clientId=${encodeURIComponent(clientId())}&name=${encodeURIComponent(deviceName())}`;

    sock = new ReconnectingSocket<ServerToObu, ObuToServer>(
      url,
      {
        onStatus: (connected) => set({ connected }),
        onMessage: (m) => handleServer(m, set, get),
      },
      15000
    );
    sock.connect();

    // Local PIS sub-server (Electron / desktop). Silently retries; absent on plain Android.
    pis = new ReconnectingSocket<unknown, unknown>(
      () => `ws://127.0.0.1:${PIS_PORT}/ws?role=obu`,
      {
        onStatus: (pisConnected) => {
          set({ pisConnected });
          if (pisConnected) pisSend(pisState(get().session));
        },
        onMessage: () => {},
      },
      0
    );
    pis.connect();

    if ("geolocation" in navigator) {
      geoWatch = navigator.geolocation.watchPosition(
        (pos) => {
          set({ gpsFix: true });
          const { latitude: lat, longitude: lon, speed } = pos.coords;
          get().send({ t: "gps", lat, lon, speedKmh: speed != null ? Math.round(speed * 3.6) : undefined });
          checkGeofence(get().session, lat, lon);
        },
        () => set({ gpsFix: false }),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
      );
    }
  },

  stop: () => {
    sock?.close();
    pis?.close();
    sock = null;
    pis = null;
    if (geoWatch != null) navigator.geolocation.clearWatch(geoWatch);
  },
}));

function checkGeofence(s: SessionDto | null, lat: number, lon: number) {
  if (!s?.run || s.phase !== "RUNNING") return;
  const stop = s.run.stops.find((x) => x.index === s.currentStopIndex);
  if (!stop || stop.lat == null || stop.lon == null || stop.cancelled) return;
  if (geofencedIndex === stop.index) return;
  if (distanceM(lat, lon, stop.lat, stop.lon) <= GEOFENCE_M) {
    geofencedIndex = stop.index;
    if (!pisSend({ t: "event", kind: "GEOFENCE", stopIndex: stop.index })) speakLocal(`Approaching ${stop.name}`);
  }
}

type Set = (p: Partial<ObuState> | ((s: ObuState) => Partial<ObuState>)) => void;

function handleServer(m: ServerToObu, set: Set, get: () => ObuState) {
  switch (m.t) {
    case "hello.ok":
      set({ canned: m.canned, clockOffsetMs: m.serverNowMs - Date.now() });
      if (get().session?.driver) get().send({ t: "runs.list" });
      break;
    case "session": {
      const prev = get().session;
      set({ session: m.session, loginError: null, clockOffsetMs: m.session.serverNowMs - Date.now() });
      pisSend(pisState(m.session));
      const s = m.session;
      if (prev?.run && s.run && prev.run.timetableId === s.run.timetableId) {
        // doors closed -> train departed towards the next stop
        if (prev.phase === "AT_STOP" && s.phase === "RUNNING" && s.currentStopIndex > prev.currentStopIndex) {
          const next = s.run.stops.find((x) => x.index === s.currentStopIndex);
          const isTerminal = s.currentStopIndex >= s.run.terminalIndex;
          if (!pisSend({ t: "event", kind: "DOOR_CLOSED", stopIndex: s.currentStopIndex }) && next) {
            speakLocal(isTerminal ? `This is the final stop, ${next.name}.` : `Next stop: ${next.name}`);
          }
        }
      }
      if (!s.run || s.currentStopIndex !== prev?.currentStopIndex) geofencedIndex = -1;
      break;
    }
    case "login.err":
      set({ loginError: m.reason });
      break;
    case "runs":
      set({ runs: m.runs });
      break;
    case "inbox":
      set({ inbox: m.messages });
      break;
    case "message.new": {
      set((s) => ({ inbox: [m.message, ...s.inbox.filter((x) => x.id !== m.message.id)] }));
      if (m.popup) set({ popup: { id: m.message.id, text: m.message.content, from: m.message.fromName, until: Date.now() + m.durationSec * 1000 } });
      break;
    }
    case "message.sent":
      get().pushToast(m.ok ? "info" : "error", m.ok ? `Sent to dispatch: ${m.label}` : m.label);
      break;
    case "advisory":
      break; // advisories arrive inside the session DTO; this frame is only a hint for sound/vibration
    case "panic.state":
      set({ panicActive: m.active });
      break;
    case "toast":
      get().pushToast(m.level, m.text);
      break;
    case "pong":
      if (pingSentAt) set({ latencyMs: Date.now() - pingSentAt });
      pingSentAt = 0;
      break;
  }
}

/** Latency probe used by the Settings tab. */
export function probeLatency() {
  pingSentAt = Date.now();
  useObu.getState().send({ t: "ping" });
}
