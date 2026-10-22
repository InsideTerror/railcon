import { prisma } from "./db.js";
import { config } from "./config.js";
import { diffSec, nowSec } from "./time.js";
import { clearFailures, isLocked, recordFailure, verifyUser } from "./auth.js";
import {
  ClientState,
  broadcastDash,
  clients,
  loadRun,
  minutes,
  newClient,
  pushFleet,
  reliefAssignments,
  removeClient,
  sendObu,
  terminalIndexOf,
  toDashMessage,
  toInbox,
  touch,
} from "./state.js";
import type { RunListItem } from "./protocol.js";

export class CmdError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ---------------------------------------------------------------- connect / disconnect
export function getOrCreateClient(clientId: string, deviceName: string, ip: string): ClientState {
  let c = clients.get(clientId);
  if (!c) {
    c = newClient(clientId);
    clients.set(clientId, c);
  }
  if (deviceName) c.deviceName = deviceName;
  c.ip = ip;
  c.lastSeen = Date.now();
  return c;
}

export function onDisconnect(c: ClientState) {
  c.online = false;
  c.socket = null;
  c.lastSeen = Date.now();
  if (!c.driver && !c.run) {
    removeClient(c); // unauthenticated device that went away
  } else {
    pushFleet(c); // keep the session for the GSM grace period
  }
}

// ---------------------------------------------------------------- login / logout
export async function login(c: ClientState, forteId: string, pin: string): Promise<string | null> {
  const lockKeys = [`c:${c.clientId}`, `u:${forteId}`];
  if (lockKeys.some(isLocked)) return "Too many failed attempts. Try again in 5 minutes.";
  const user = await verifyUser(forteId, pin, ["DRIVER"]);
  if (!user) {
    lockKeys.forEach(recordFailure);
    return "Invalid Driver ID or PIN.";
  }
  lockKeys.forEach(clearFailures);
  for (const other of clients.values()) {
    if (other !== c && other.driver?.id === user.id) {
      return `Driver ${user.forteId} is already logged in on ${other.deviceName || other.clientId}.`;
    }
  }
  c.driver = { id: user.id, forteId: user.forteId, name: user.name };
  touch(c);
  return null;
}

export function logout(c: ClientState) {
  c.driver = null;
  c.run = null;
  resetRunState(c);
  c.advisories.clear();
  touch(c);
}

function resetRunState(c: ClientState) {
  c.currentStopIndex = 1;
  c.phase = "RUNNING";
  c.doorsOpen = false;
  c.delaySec = 0;
  c.scheduleShiftSec = 0;
  c.truncatedAtIndex = null;
  c.stopOffsets = {};
  c.early = false;
}

// ---------------------------------------------------------------- runs
export async function listRuns(c: ClientState): Promise<RunListItem[]> {
  const now = nowSec();
  const inUse = new Set<number>();
  for (const o of clients.values()) if (o !== c && o.run) inUse.add(o.run.timetableId);

  const rows = await prisma.timetable.findMany({
    where: { endTime: { gte: now - 30 * 60 } },
    orderBy: [{ startTime: "asc" }, { runNumber: "asc" }],
    take: 120,
    include: { stops: { include: { station: true }, orderBy: { stopSequenceIndex: "asc" } } },
  });
  const items: RunListItem[] = [];
  for (const t of rows) {
    if (inUse.has(t.id)) continue;
    const owner = reliefAssignments.get(t.id);
    if (owner && owner !== c.clientId) continue;
    items.push({
      timetableId: t.id,
      routeId: t.routeId,
      runNumber: t.runNumber,
      direction: t.direction,
      startTime: t.startTime,
      endTime: t.endTime,
      from: t.stops[0]?.station.name ?? "?",
      to: t.stops[t.stops.length - 1]?.station.name ?? "?",
      isRelief: t.isRelief,
      assigned: owner === c.clientId,
    });
  }
  // assigned relief runs first, then chronological
  items.sort((a, b) => Number(b.assigned) - Number(a.assigned) || a.startTime - b.startTime);
  return items.slice(0, 60);
}

export async function selectRun(c: ClientState, timetableId: number): Promise<string | null> {
  if (!c.driver) return "Log in first.";
  if (c.run && !(c.currentStopIndex === 1 && c.phase === "RUNNING")) return "End the current run before selecting another.";
  for (const o of clients.values()) {
    if (o !== c && o.run?.timetableId === timetableId) return "That run is already in use on another device.";
  }
  const owner = reliefAssignments.get(timetableId);
  if (owner && owner !== c.clientId) return "That relief run is assigned to another device.";
  const run = await loadRun(timetableId);
  if (!run) return "Run not found.";
  c.run = run;
  resetRunState(c);
  reliefAssignments.delete(timetableId);
  touch(c);
  return null;
}

export function endRun(c: ClientState, reason: "driver" | "completed" = "driver") {
  const wasRun = c.run;
  c.run = null;
  resetRunState(c);
  c.advisories.clear();
  touch(c);
  if (wasRun) {
    sendObu(c, {
      t: "toast",
      level: "info",
      text: reason === "completed" ? `Run ${wasRun.routeId} / ${wasRun.runNumber} completed.` : "Run ended.",
    });
  }
}

// ---------------------------------------------------------------- stop state machine
function currentStop(c: ClientState) {
  return c.run?.stops.find((s) => s.index === c.currentStopIndex) ?? null;
}

/** Train arrived at the current stop (doors open). Measures delay against the arrival time. */
function arrive(c: ClientState) {
  const stop = currentStop(c);
  if (!stop) return;
  const delay = diffSec(nowSec(), stop.arr + c.scheduleShiftSec);
  c.delaySec = delay;
  c.stopOffsets[stop.index] = minutes(delay);
  c.phase = "AT_STOP";
  c.doorsOpen = true;
  c.early = false;
}

/** Doors closed / departure confirmed. Measures delay against the departure time. */
function depart(c: ClientState) {
  const stop = currentStop(c);
  if (!stop) return;
  const terminal = terminalIndexOf(c);
  c.doorsOpen = false;
  if (stop.index >= terminal) {
    endRun(c, "completed");
    return;
  }
  const depDelay = diffSec(nowSec(), stop.dep + c.scheduleShiftSec);
  c.delaySec = depDelay;
  c.stopOffsets[stop.index] = minutes(depDelay);
  c.early = depDelay < -config.earlyToleranceSec;
  c.currentStopIndex = stop.index + 1;
  c.phase = "RUNNING";
  touch(c);
}

export function door(c: ClientState, state: "OPEN" | "CLOSED") {
  if (!c.run || !c.driver) return;
  if (state === "OPEN") {
    if (c.phase === "RUNNING") arrive(c);
    c.doorsOpen = true;
    touch(c);
  } else if (c.phase === "AT_STOP") {
    depart(c);
  } else {
    c.doorsOpen = false;
    touch(c);
  }
}

/** Manual step: advance one stop without door events. */
export function stepManual(c: ClientState) {
  if (!c.run || !c.driver) return;
  if (c.phase === "AT_STOP") {
    depart(c);
    return;
  }
  const stop = currentStop(c);
  if (!stop) return;
  if (stop.index >= terminalIndexOf(c)) {
    endRun(c, "completed");
    return;
  }
  c.currentStopIndex = stop.index + 1;
  touch(c);
}

export function setGps(c: ClientState, lat: number, lon: number, speedKmh?: number) {
  c.gps = { lat, lon, speedKmh: speedKmh ?? null, ts: Date.now() };
  if (Date.now() - c.lastGpsBroadcast > 5000) {
    c.lastGpsBroadcast = Date.now();
    pushFleet(c);
  }
}

// ---------------------------------------------------------------- messages
async function createMessage(args: {
  type: "STATUS" | "DISPATCH_POPUP" | "PANIC";
  content: string;
  senderId?: number | null;
  senderClientId?: string | null;
  receiverClientId?: string | null;
}) {
  const row = await prisma.message.create({
    data: {
      type: args.type,
      content: args.content,
      senderId: args.senderId ?? null,
      senderClientId: args.senderClientId ?? null,
      receiverClientId: args.receiverClientId ?? null,
    },
    include: { sender: true },
  });
  broadcastDash({ t: "message.new", message: await toDashMessage(row) });
  return row;
}

export async function sendCanned(c: ClientState, optionId: number) {
  const opt = await prisma.cannedOption.findUnique({ where: { id: optionId } });
  if (!opt || opt.category !== "DRIVER_TO_DISPATCH") {
    sendObu(c, { t: "message.sent", ok: false, label: "Unknown message" });
    return;
  }
  const ctx = c.run ? `[${c.run.routeId} / ${c.run.runNumber}] ` : "";
  await createMessage({
    type: "STATUS",
    content: `${ctx}${opt.label}: ${opt.templateText}`,
    senderId: c.driver?.id ?? null,
    senderClientId: c.clientId,
  });
  sendObu(c, { t: "message.sent", ok: true, label: opt.label });
}

export async function logAnnouncement(c: ClientState, text: string) {
  const ctx = c.run ? `[${c.run.routeId} / ${c.run.runNumber}] ` : "";
  await createMessage({
    type: "STATUS",
    content: `${ctx}Announcement played: "${text}"`,
    senderId: c.driver?.id ?? null,
    senderClientId: c.clientId,
  });
}

export async function panic(c: ClientState) {
  if (c.panicMessageId != null) return;
  const ctx = c.run ? ` on ${c.run.routeId} / ${c.run.runNumber}` : "";
  const stop = currentStop(c);
  const where = stop ? ` near ${stop.name}` : "";
  const row = await createMessage({
    type: "PANIC",
    content: `PANIC ALERT from ${c.driver?.name ?? c.deviceName ?? c.clientId}${ctx}${where}`,
    senderId: c.driver?.id ?? null,
    senderClientId: c.clientId,
  });
  c.panicMessageId = row.id;
  sendObu(c, { t: "panic.state", active: true });
  touch(c);
}

export async function ackPanic(messageId: number) {
  const row = await prisma.message.update({ where: { id: messageId }, data: { acknowledged: true } }).catch(() => null);
  if (!row) throw new CmdError("Message not found", 404);
  for (const c of clients.values()) {
    if (c.panicMessageId === messageId) {
      c.panicMessageId = null;
      sendObu(c, { t: "panic.state", active: false });
      touch(c);
    }
  }
  broadcastDash({ t: "message.acked", id: messageId });
}

export async function ackMessages(c: ClientState, ids: number[]) {
  if (ids.length === 0) return;
  await prisma.message.updateMany({
    where: { id: { in: ids }, receiverClientId: c.clientId },
    data: { acknowledged: true },
  });
  await sendInbox(c);
}

export async function sendInbox(c: ClientState) {
  const rows = await prisma.message.findMany({
    where: { receiverClientId: c.clientId },
    orderBy: { timestamp: "desc" },
    take: 50,
    include: { sender: true },
  });
  sendObu(c, { t: "inbox", messages: rows.map(toInbox) });
}

/** Message to an OBU from the dispatcher (popup) or from the system (silent). */
export async function deliverToObu(
  c: ClientState,
  content: string,
  opts: { senderId?: number | null; popup: boolean }
) {
  const row = await createMessage({
    type: "DISPATCH_POPUP",
    content,
    senderId: opts.senderId ?? null,
    receiverClientId: c.clientId,
  });
  sendObu(c, { t: "message.new", message: toInbox(row), popup: opts.popup, durationSec: config.popupSeconds });
}

// ---------------------------------------------------------------- dispatcher commands
function mustGet(clientId: string): ClientState {
  const c = clients.get(clientId);
  if (!c) throw new CmdError("Client not found", 404);
  return c;
}

export function cmdTruncate(clientId: string, afterStopIndex?: number) {
  const c = mustGet(clientId);
  if (!c.run) throw new CmdError("Client has no active run");
  const last = c.run.stops[c.run.stops.length - 1].index;
  const k = afterStopIndex ?? c.currentStopIndex;
  if (k < c.currentStopIndex) throw new CmdError("Cannot truncate before the current stop");
  if (k > last) throw new CmdError("Stop index out of range");
  c.truncatedAtIndex = k >= last ? null : k;
  const name = c.run.stops.find((s) => s.index === k)?.name ?? "?";
  touch(c);
  sendObu(c, {
    t: "toast",
    level: "info",
    text: c.truncatedAtIndex == null ? "Run restored to full length." : `Run truncated: terminates at ${name}.`,
  });
}

export function cmdOverride(clientId: string, mode: "DELAY" | "SHIFT", minutesValue: number) {
  const c = mustGet(clientId);
  if (!c.run) throw new CmdError("Client has no active run");
  if (mode === "DELAY") {
    c.delaySec = minutesValue * 60;
    c.early = false;
  } else {
    // Positive shift = timetable moves later = displayed delay shrinks.
    c.scheduleShiftSec += minutesValue * 60;
    c.delaySec -= minutesValue * 60;
  }
  touch(c);
  sendObu(c, {
    t: "toast",
    level: "info",
    text: mode === "DELAY" ? `Dispatch set schedule offset to ${minutesValue >= 0 ? "+" : ""}${minutesValue} min.` : `Dispatch shifted the timetable by ${minutesValue >= 0 ? "+" : ""}${minutesValue} min.`,
  });
}

export function cmdTerminate(clientId: string, target: "DRIVER" | "ROUTE" | "BOTH") {
  const c = mustGet(clientId);
  if (target === "DRIVER" || target === "BOTH") c.driver = null;
  if (target === "ROUTE" || target === "BOTH") {
    c.run = null;
    resetRunState(c);
    c.advisories.clear();
  }
  touch(c);
  sendObu(c, {
    t: "toast",
    level: "error",
    text:
      target === "DRIVER" ? "Dispatch has logged you out." : target === "ROUTE" ? "Dispatch has terminated your run." : "Dispatch has terminated your session.",
  });
}

export async function cmdPopup(targets: string[] | "ALL", content: string, senderId: number | null) {
  const list =
    targets === "ALL" ? [...clients.values()].filter((c) => c.online) : targets.map((id) => clients.get(id)).filter((c): c is ClientState => !!c);
  if (list.length === 0) throw new CmdError("No target clients");
  for (const c of list) await deliverToObu(c, content, { senderId, popup: true });
  return list.length;
}

/** Clone a timetable into a relief/extra run, optionally shifted, optionally assigned to a client. */
export async function cmdRelief(args: { baseTimetableId: number; runNumber?: string; shiftMinutes: number; clientId?: string }) {
  const base = await prisma.timetable.findUnique({ where: { id: args.baseTimetableId }, include: { stops: true } });
  if (!base) throw new CmdError("Base timetable not found", 404);
  const target = args.clientId ? mustGet(args.clientId) : null;

  let runNumber = args.runNumber?.trim();
  if (!runNumber) {
    const existing = await prisma.timetable.findMany({ where: { routeId: base.routeId, isRelief: true }, select: { runNumber: true } });
    runNumber = `R${String(existing.length + 1).padStart(3, "0")}`;
    while (existing.some((e) => e.runNumber === runNumber)) runNumber = `R${String(Number(runNumber.slice(1)) + 1).padStart(3, "0")}`;
  }
  const clash = await prisma.timetable.findUnique({ where: { routeId_runNumber: { routeId: base.routeId, runNumber } } });
  if (clash) throw new CmdError(`Run ${base.routeId} / ${runNumber} already exists`);

  const shift = Math.round(args.shiftMinutes * 60);
  const created = await prisma.timetable.create({
    data: {
      routeId: base.routeId,
      runNumber,
      startTime: base.startTime + shift,
      endTime: base.endTime + shift,
      direction: base.direction,
      isRelief: true,
      stops: {
        create: base.stops.map((s) => ({
          stationId: s.stationId,
          stopSequenceIndex: s.stopSequenceIndex,
          scheduledArrival: s.scheduledArrival + shift,
          scheduledDeparture: s.scheduledDeparture + shift,
        })),
      },
    },
  });

  if (target) {
    reliefAssignments.set(created.id, target.clientId);
    if (target.driver && !target.run) {
      await selectRun(target, created.id);
      sendObu(target, { t: "toast", level: "info", text: `Relief run ${base.routeId} / ${runNumber} assigned by dispatch.` });
    } else {
      await deliverToObu(target, `Relief run ${base.routeId} / ${runNumber} is available for you in Duty / Activity.`, { popup: true });
    }
  }
  return { timetableId: created.id, routeId: base.routeId, runNumber };
}

export async function recentMessages(limit = 50) {
  const rows = await prisma.message.findMany({ orderBy: { timestamp: "desc" }, take: limit, include: { sender: true } });
  return Promise.all(rows.reverse().map(toDashMessage));
}
