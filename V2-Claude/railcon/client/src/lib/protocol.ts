/**
 * Wire protocol shared by server, OBU client and dispatcher dashboard.
 * A copy lives in client/src/lib/protocol.ts - keep both in sync.
 *
 * Endpoints (both served by the same Fastify process, see deploy/cloudflared.yml):
 *   wss://railcon.corerail.dpdns.org/ws/obu?clientId=<id>&name=<device name>
 *   wss://dash.corerail.dpdns.org/ws/dash?token=<jwt>
 */

export type Phase = "RUNNING" | "AT_STOP";
export type SessionStatusT = "ACTIVE" | "IDLE" | "NON_ACTIVE";
export type MessageTypeT = "STATUS" | "DISPATCH_POPUP" | "PANIC";

export interface CannedOptionDto {
  id: number;
  category: "DRIVER_TO_DISPATCH" | "PASSENGER_ANNOUNCEMENT";
  label: string;
  templateText: string;
  displayOrder: number;
}

export interface DriverDto {
  id: number;
  forteId: string;
  name: string;
}

export interface StopDto {
  index: number;
  stationId: number;
  name: string;
  code: string;
  lat: number | null;
  lon: number | null;
  arr: number; // scheduled arrival, seconds after midnight (already includes dispatcher shift)
  dep: number; // scheduled departure
  offsetMin: number | null; // measured offset at this stop, minutes (null = not served yet)
  cancelled: boolean; // removed by dispatcher truncation
}

export interface RunDto {
  timetableId: number;
  routeId: string;
  routeName: string;
  runNumber: string;
  direction: number;
  isRelief: boolean;
  terminalIndex: number;
  stops: StopDto[];
}

export interface AdvisoryDto {
  id: string;
  kind: "HOLD" | "CANCEL";
  text: string;
  detail: string;
  ts: number;
}

export interface SessionDto {
  clientId: string;
  status: SessionStatusT;
  driver: DriverDto | null;
  run: RunDto | null;
  currentStopIndex: number;
  phase: Phase;
  doorsOpen: boolean;
  delaySec: number;
  delayMinutes: number;
  early: boolean;
  panicActive: boolean;
  advisories: AdvisoryDto[];
  serverNowSec: number;
  serverNowMs: number;
}

export interface InboxMessageDto {
  id: number;
  type: MessageTypeT;
  content: string;
  timestamp: string;
  acknowledged: boolean;
  fromName: string;
}

export interface RunListItem {
  timetableId: number;
  routeId: string;
  runNumber: string;
  direction: number;
  startTime: number;
  endTime: number;
  from: string;
  to: string;
  isRelief: boolean;
  assigned: boolean;
}

// ---------------- OBU -> server ----------------
export type ObuToServer =
  | { t: "login"; forteId: string; pin: string }
  | { t: "logout" }
  | { t: "runs.list" }
  | { t: "run.select"; timetableId: number }
  | { t: "run.end" }
  | { t: "duty.log"; fuelLiters?: number; mileageKm?: number; note?: string }
  | { t: "door"; state: "OPEN" | "CLOSED" }
  | { t: "step.manual" }
  | { t: "message.send"; optionId: number }
  | { t: "announce"; optionId?: number; text: string }
  | { t: "panic" }
  | { t: "ack"; messageIds: number[] }
  | { t: "inbox.list" }
  | { t: "gps"; lat: number; lon: number; speedKmh?: number }
  | { t: "ping" };

// ---------------- server -> OBU ----------------
export type ServerToObu =
  | { t: "hello.ok"; clientId: string; serverNowMs: number; canned: CannedOptionDto[] }
  | { t: "login.err"; reason: string }
  | { t: "session"; session: SessionDto }
  | { t: "runs"; runs: RunListItem[] }
  | { t: "inbox"; messages: InboxMessageDto[] }
  | { t: "message.new"; message: InboxMessageDto; popup: boolean; durationSec: number }
  | { t: "message.sent"; ok: boolean; label: string }
  | { t: "advisory"; advisory: AdvisoryDto; revoked?: boolean }
  | { t: "panic.state"; active: boolean }
  | { t: "toast"; level: "info" | "error"; text: string }
  | { t: "pong"; serverNowMs: number };

// ---------------- dashboard ----------------
export interface FleetRow {
  clientId: string;
  deviceName: string;
  online: boolean;
  status: SessionStatusT;
  driver: DriverDto | null;
  routeId: string | null;
  routeName: string | null;
  runNumber: string | null;
  timetableId: number | null;
  direction: number | null;
  currentStopIndex: number;
  currentStopName: string | null;
  nextStopName: string | null;
  terminalName: string | null;
  terminalIndex: number | null;
  truncated: boolean;
  phase: Phase;
  doorsOpen: boolean;
  delayMinutes: number;
  early: boolean;
  panic: boolean;
  advisories: AdvisoryDto[];
  gps: { lat: number; lon: number; speedKmh: number | null; ts: number } | null;
  lastSeen: number;
  stops: { index: number; name: string; cancelled: boolean }[];
}

export interface DashMessage {
  id: number;
  type: MessageTypeT;
  content: string;
  timestamp: string;
  acknowledged: boolean;
  fromClientId: string | null;
  toClientId: string | null;
  fromName: string;
  routeRun: string | null;
}

export type ServerToDash =
  | { t: "snapshot"; fleet: FleetRow[]; messages: DashMessage[] }
  | { t: "fleet.update"; row: FleetRow }
  | { t: "fleet.remove"; clientId: string }
  | { t: "message.new"; message: DashMessage }
  | { t: "message.acked"; id: number };
