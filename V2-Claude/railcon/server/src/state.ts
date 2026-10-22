import { WebSocket } from "ws";
import { prisma } from "./db.js";
import { nowSec } from "./time.js";
import type {
  AdvisoryDto,
  DashMessage,
  DriverDto,
  FleetRow,
  InboxMessageDto,
  Phase,
  RunDto,
  ServerToDash,
  ServerToObu,
  SessionDto,
  SessionStatusT,
  StopDto,
} from "./protocol.js";
import { config } from "./config.js";

export interface BaseStop {
  index: number;
  stationId: number;
  name: string;
  code: string;
  lat: number | null;
  lon: number | null;
  arr: number; // unshifted scheduled arrival (s after midnight)
  dep: number;
}

export interface RunData {
  timetableId: number;
  routeId: string;
  routeName: string;
  runNumber: string;
  direction: number;
  isRelief: boolean;
  stops: BaseStop[];
}

export interface ClientState {
  clientId: string;
  deviceName: string;
  online: boolean;
  socket: WebSocket | null;
  ip: string;
  lastSeen: number;
  driver: DriverDto | null;
  run: RunData | null;
  currentStopIndex: number;
  phase: Phase;
  doorsOpen: boolean;
  delaySec: number;
  scheduleShiftSec: number;
  truncatedAtIndex: number | null;
  stopOffsets: Record<number, number>;
  early: boolean;
  gps: { lat: number; lon: number; speedKmh: number | null; ts: number } | null;
  lastGpsBroadcast: number;
  panicMessageId: number | null;
  advisories: Map<string, AdvisoryDto>;
  persistChain: Promise<void>;
}

export const clients = new Map<string, ClientState>();
export const dashSockets = new Set<WebSocket>();
/** relief run id -> client id it was assigned to */
export const reliefAssignments = new Map<number, string>();

let afterChange: (() => void) | null = null;
export function setAfterChange(fn: () => void) {
  afterChange = fn;
}

export function newClient(clientId: string): ClientState {
  return {
    clientId,
    deviceName: "",
    online: false,
    socket: null,
    ip: "",
    lastSeen: Date.now(),
    driver: null,
    run: null,
    currentStopIndex: 1,
    phase: "RUNNING",
    doorsOpen: false,
    delaySec: 0,
    scheduleShiftSec: 0,
    truncatedAtIndex: null,
    stopOffsets: {},
    early: false,
    gps: null,
    lastGpsBroadcast: 0,
    panicMessageId: null,
    advisories: new Map(),
    persistChain: Promise.resolve(),
  };
}

export function statusOf(c: ClientState): SessionStatusT {
  if (c.driver && c.run) return "ACTIVE";
  if (c.driver || c.run) return "IDLE";
  return "NON_ACTIVE";
}

export function terminalIndexOf(c: ClientState): number {
  if (!c.run) return 0;
  const last = c.run.stops[c.run.stops.length - 1]?.index ?? 0;
  return c.truncatedAtIndex != null ? Math.min(c.truncatedAtIndex, last) : last;
}

export function minutes(sec: number): number {
  return Math.round(sec / 60) || 0; // || 0 normalises -0
}

function stopDtos(c: ClientState): StopDto[] {
  if (!c.run) return [];
  const terminal = terminalIndexOf(c);
  return c.run.stops.map((s) => ({
    index: s.index,
    stationId: s.stationId,
    name: s.name,
    code: s.code,
    lat: s.lat,
    lon: s.lon,
    arr: s.arr + c.scheduleShiftSec,
    dep: s.dep + c.scheduleShiftSec,
    offsetMin: c.stopOffsets[s.index] ?? null,
    cancelled: s.index > terminal,
  }));
}

export function runDto(c: ClientState): RunDto | null {
  if (!c.run) return null;
  return {
    timetableId: c.run.timetableId,
    routeId: c.run.routeId,
    routeName: c.run.routeName,
    runNumber: c.run.runNumber,
    direction: c.run.direction,
    isRelief: c.run.isRelief,
    terminalIndex: terminalIndexOf(c),
    stops: stopDtos(c),
  };
}

export function sessionDto(c: ClientState): SessionDto {
  return {
    clientId: c.clientId,
    status: statusOf(c),
    driver: c.driver,
    run: runDto(c),
    currentStopIndex: c.currentStopIndex,
    phase: c.phase,
    doorsOpen: c.doorsOpen,
    delaySec: Math.round(c.delaySec),
    delayMinutes: minutes(c.delaySec),
    early: c.early,
    panicActive: c.panicMessageId != null,
    advisories: [...c.advisories.values()],
    serverNowSec: nowSec(),
    serverNowMs: Date.now(),
  };
}

export function fleetRow(c: ClientState): FleetRow {
  const run = c.run;
  const terminal = terminalIndexOf(c);
  const stopName = (i: number) => run?.stops.find((s) => s.index === i)?.name ?? null;
  return {
    clientId: c.clientId,
    deviceName: c.deviceName,
    online: c.online,
    status: statusOf(c),
    driver: c.driver,
    routeId: run?.routeId ?? null,
    routeName: run?.routeName ?? null,
    runNumber: run?.runNumber ?? null,
    timetableId: run?.timetableId ?? null,
    direction: run?.direction ?? null,
    currentStopIndex: c.currentStopIndex,
    currentStopName: run ? stopName(c.currentStopIndex) : null,
    nextStopName: run && c.currentStopIndex < terminal ? stopName(c.currentStopIndex + 1) : null,
    terminalName: run ? stopName(terminal) : null,
    terminalIndex: run ? terminal : null,
    truncated: !!run && terminal < (run.stops[run.stops.length - 1]?.index ?? 0),
    phase: c.phase,
    doorsOpen: c.doorsOpen,
    delayMinutes: minutes(c.delaySec),
    early: c.early,
    panic: c.panicMessageId != null,
    advisories: [...c.advisories.values()],
    gps: c.gps,
    lastSeen: c.lastSeen,
    stops: run ? run.stops.map((s) => ({ index: s.index, name: s.name, cancelled: s.index > terminal })) : [],
  };
}

// ---------------------------------------------------------------- send helpers
export function sendObu(c: ClientState, msg: ServerToObu) {
  if (c.socket && c.socket.readyState === WebSocket.OPEN) c.socket.send(JSON.stringify(msg));
}

export function broadcastDash(msg: ServerToDash) {
  const data = JSON.stringify(msg);
  for (const ws of dashSockets) if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

export function pushFleet(c: ClientState) {
  broadcastDash({ t: "fleet.update", row: fleetRow(c) });
}

/** Persist + push the session to the OBU + push the fleet row to dashboards. */
export function touch(c: ClientState) {
  persist(c);
  sendObu(c, { t: "session", session: sessionDto(c) });
  pushFleet(c);
  afterChange?.();
}

export function removeClient(c: ClientState) {
  clients.delete(c.clientId);
  c.persistChain = c.persistChain
    .then(async () => {
      await prisma.activeSession.deleteMany({ where: { clientId: c.clientId } });
    })
    .catch((e) => console.error("persist delete failed", e));
  broadcastDash({ t: "fleet.remove", clientId: c.clientId });
  afterChange?.();
}

// ---------------------------------------------------------------- persistence
export function persist(c: ClientState) {
  c.persistChain = c.persistChain
    .then(async () => {
      if (!c.driver && !c.run) {
        await prisma.activeSession.deleteMany({ where: { clientId: c.clientId } });
        return;
      }
      const data = {
        deviceName: c.deviceName,
        driverId: c.driver?.id ?? null,
        timetableId: c.run?.timetableId ?? null,
        currentStopIndex: c.currentStopIndex,
        delayMinutes: minutes(c.delaySec),
        status: statusOf(c),
        phase: c.phase,
        doorsOpen: c.doorsOpen,
        truncatedAtIndex: c.truncatedAtIndex,
        scheduleShiftSec: c.scheduleShiftSec,
        stopOffsets: c.stopOffsets as object,
        earlyDeparture: c.early,
      };
      await prisma.activeSession.upsert({
        where: { clientId: c.clientId },
        create: { clientId: c.clientId, ...data },
        update: data,
      });
    })
    .catch((e) => console.error("persist failed", e));
}

// ---------------------------------------------------------------- data loading
export async function loadRun(timetableId: number): Promise<RunData | null> {
  const t = await prisma.timetable.findUnique({
    where: { id: timetableId },
    include: {
      route: true,
      stops: { include: { station: true }, orderBy: { stopSequenceIndex: "asc" } },
    },
  });
  if (!t || t.stops.length === 0) return null;
  return {
    timetableId: t.id,
    routeId: t.routeId,
    routeName: t.route.name,
    runNumber: t.runNumber,
    direction: t.direction,
    isRelief: t.isRelief,
    stops: t.stops.map((s) => ({
      index: s.stopSequenceIndex,
      stationId: s.stationId,
      name: s.station.name,
      code: s.station.code,
      lat: s.station.lat,
      lon: s.station.lon,
      arr: s.scheduledArrival,
      dep: s.scheduledDeparture,
    })),
  };
}

/** Restore logged-in / running sessions after a server restart. */
export async function hydrateFromDb() {
  const rows = await prisma.activeSession.findMany({
    where: { OR: [{ driverId: { not: null } }, { timetableId: { not: null } }] },
    include: { driver: true },
  });
  for (const r of rows) {
    const c = newClient(r.clientId);
    c.deviceName = r.deviceName;
    c.lastSeen = r.updatedAt.getTime();
    if (r.driver) c.driver = { id: r.driver.id, forteId: r.driver.forteId, name: r.driver.name };
    if (r.timetableId != null) c.run = await loadRun(r.timetableId);
    c.currentStopIndex = r.currentStopIndex;
    c.phase = r.phase === "AT_STOP" ? "AT_STOP" : "RUNNING";
    c.doorsOpen = r.doorsOpen;
    c.delaySec = r.delayMinutes * 60;
    c.truncatedAtIndex = r.truncatedAtIndex;
    c.scheduleShiftSec = r.scheduleShiftSec;
    c.stopOffsets = (r.stopOffsets as Record<number, number>) ?? {};
    c.early = r.earlyDeparture;
    if (!c.driver && !c.run) continue;
    clients.set(c.clientId, c);
  }
  return rows.length;
}

/** Drop offline sessions whose grace period expired. */
export function sweepOfflineSessions() {
  const now = Date.now();
  for (const c of [...clients.values()]) {
    if (!c.online && now - c.lastSeen > config.sessionGraceMs) removeClient(c);
  }
}

// ---------------------------------------------------------------- messages
export async function toDashMessage(m: {
  id: number;
  type: "STATUS" | "DISPATCH_POPUP" | "PANIC";
  content: string;
  timestamp: Date;
  acknowledged: boolean;
  senderClientId: string | null;
  receiverClientId: string | null;
  sender?: { name: string } | null;
}): Promise<DashMessage> {
  const from = m.senderClientId ? clients.get(m.senderClientId) : undefined;
  return {
    id: m.id,
    type: m.type,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    acknowledged: m.acknowledged,
    fromClientId: m.senderClientId,
    toClientId: m.receiverClientId,
    fromName: m.sender?.name ?? (m.senderClientId ? from?.driver?.name ?? m.senderClientId : "System"),
    routeRun: from?.run ? `${from.run.routeId} / ${from.run.runNumber}` : null,
  };
}

export function toInbox(m: {
  id: number;
  type: "STATUS" | "DISPATCH_POPUP" | "PANIC";
  content: string;
  timestamp: Date;
  acknowledged: boolean;
  sender?: { name: string } | null;
}): InboxMessageDto {
  return {
    id: m.id,
    type: m.type,
    content: m.content,
    timestamp: m.timestamp.toISOString(),
    acknowledged: m.acknowledged,
    fromName: m.sender ? `Dispatch (${m.sender.name})` : "System",
  };
}
