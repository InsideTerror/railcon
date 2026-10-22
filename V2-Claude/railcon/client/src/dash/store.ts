import { create } from "zustand";
import { ReconnectingSocket } from "../lib/socket";
import { serverBase, toWsBase } from "../lib/config";
import { getToken } from "../lib/api";
import type { DashMessage, FleetRow, ServerToDash } from "../lib/protocol";

interface DashState {
  connected: boolean;
  fleet: Record<string, FleetRow>;
  messages: DashMessage[];
  start: () => void;
  stop: () => void;
  ackLocal: (id: number) => void;
}

let sock: ReconnectingSocket<ServerToDash, never> | null = null;

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.3);
      osc.stop(ctx.currentTime + i * 0.3 + 0.18);
    }
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* audio blocked until first user gesture */
  }
}

export const useDash = create<DashState>((set) => ({
  connected: false,
  fleet: {},
  messages: [],

  ackLocal: (id) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, acknowledged: true } : m)) })),

  start: () => {
    if (sock) return;
    sock = new ReconnectingSocket<ServerToDash, never>(
      () => `${toWsBase(serverBase())}/ws/dash?token=${encodeURIComponent(getToken("dash") ?? "")}`,
      {
        onStatus: (connected) => set({ connected }),
        onMessage: (m) => {
          switch (m.t) {
            case "snapshot":
              set({ fleet: Object.fromEntries(m.fleet.map((r) => [r.clientId, r])), messages: m.messages });
              break;
            case "fleet.update":
              set((s) => ({ fleet: { ...s.fleet, [m.row.clientId]: m.row } }));
              break;
            case "fleet.remove":
              set((s) => {
                const next = { ...s.fleet };
                delete next[m.clientId];
                return { fleet: next };
              });
              break;
            case "message.new":
              set((s) => ({ messages: [...s.messages.filter((x) => x.id !== m.message.id), m.message].slice(-300) }));
              if (m.message.type === "PANIC" && !m.message.acknowledged) beep();
              break;
            case "message.acked":
              set((s) => ({ messages: s.messages.map((x) => (x.id === m.id ? { ...x, acknowledged: true } : x)) }));
              break;
          }
        },
      }
    );
    sock.connect();
  },

  stop: () => {
    sock?.close();
    sock = null;
    set({ connected: false, fleet: {}, messages: [] });
  },
}));
