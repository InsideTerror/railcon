import type { Server as HttpServer, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { prisma } from "./db.js";
import {
  ackMessages,
  door,
  getOrCreateClient,
  listRuns,
  login,
  logAnnouncement,
  logout,
  onDisconnect,
  panic,
  endRun,
  selectRun,
  sendCanned,
  sendInbox,
  setGps,
  stepManual,
  recentMessages,
} from "./engine.js";
import { clients, dashSockets, fleetRow, sendObu, sessionDto, touch, type ClientState } from "./state.js";
import type { CannedOptionDto, ServerToDash } from "./protocol.js";

const ObuMsg = z.discriminatedUnion("t", [
  z.object({ t: z.literal("login"), forteId: z.string().min(1).max(16), pin: z.string().min(1).max(16) }),
  z.object({ t: z.literal("logout") }),
  z.object({ t: z.literal("runs.list") }),
  z.object({ t: z.literal("run.select"), timetableId: z.number().int() }),
  z.object({ t: z.literal("run.end") }),
  z.object({
    t: z.literal("duty.log"),
    fuelLiters: z.number().nonnegative().max(100000).optional(),
    mileageKm: z.number().nonnegative().max(10000000).optional(),
    note: z.string().max(500).optional(),
  }),
  z.object({ t: z.literal("door"), state: z.enum(["OPEN", "CLOSED"]) }),
  z.object({ t: z.literal("step.manual") }),
  z.object({ t: z.literal("message.send"), optionId: z.number().int() }),
  z.object({ t: z.literal("announce"), optionId: z.number().int().optional(), text: z.string().max(500) }),
  z.object({ t: z.literal("panic") }),
  z.object({ t: z.literal("ack"), messageIds: z.array(z.number().int()).max(100) }),
  z.object({ t: z.literal("inbox.list") }),
  z.object({ t: z.literal("gps"), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), speedKmh: z.number().optional() }),
  z.object({ t: z.literal("ping") }),
]);

async function cannedDtos(): Promise<CannedOptionDto[]> {
  const rows = await prisma.cannedOption.findMany({ orderBy: [{ category: "asc" }, { displayOrder: "asc" }] });
  return rows.map((r) => ({ id: r.id, category: r.category, label: r.label, templateText: r.templateText, displayOrder: r.displayOrder }));
}

function clientIp(req: IncomingMessage): string {
  const h = req.headers;
  return String(h["cf-connecting-ip"] ?? (h["x-forwarded-for"] as string | undefined)?.split(",")[0] ?? req.socket.remoteAddress ?? "");
}

type Alive = WebSocket & { isAlive?: boolean };

function heartbeat(wss: WebSocketServer) {
  setInterval(() => {
    for (const ws of wss.clients as Set<Alive>) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 20_000);
}

export function attachWebSockets(server: HttpServer, verifyToken: (token: string) => Promise<{ role: string } | null>) {
  const obuWss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const dashWss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  heartbeat(obuWss);
  heartbeat(dashWss);

  server.on("upgrade", async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname === "/ws/obu") {
        const clientId = (url.searchParams.get("clientId") ?? "").trim();
        if (!/^[A-Za-z0-9._-]{3,64}$/.test(clientId)) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          return socket.destroy();
        }
        obuWss.handleUpgrade(req, socket, head, (ws) => onObuConnection(ws, req, clientId, (url.searchParams.get("name") ?? "").slice(0, 64)));
      } else if (url.pathname === "/ws/dash") {
        const user = await verifyToken(url.searchParams.get("token") ?? "");
        if (!user || (user.role !== "DISPATCHER" && user.role !== "SYSADMIN")) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          return socket.destroy();
        }
        dashWss.handleUpgrade(req, socket, head, (ws) => void onDashConnection(ws));
      } else {
        socket.destroy();
      }
    } catch {
      socket.destroy();
    }
  });
}

// ------------------------------------------------------------------ OBU
function onObuConnection(ws: Alive, req: IncomingMessage, clientId: string, name: string) {
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));

  const c = getOrCreateClient(clientId, name, clientIp(req));
  if (c.socket && c.socket !== ws && c.socket.readyState === WebSocket.OPEN) c.socket.close(4000, "replaced by newer connection");
  c.socket = ws;
  c.online = true;

  void (async () => {
    sendObu(c, { t: "hello.ok", clientId, serverNowMs: Date.now(), canned: await cannedDtos() });
    sendObu(c, { t: "session", session: sessionDto(c) });
    if (c.driver) {
      await sendInbox(c);
      sendObu(c, { t: "panic.state", active: c.panicMessageId != null });
    }
    touch(c); // announce to dashboards, persist
  })();

  ws.on("message", (raw) => {
    c.lastSeen = Date.now();
    let parsed;
    try {
      parsed = ObuMsg.parse(JSON.parse(raw.toString()));
    } catch {
      sendObu(c, { t: "toast", level: "error", text: "Malformed message ignored." });
      return;
    }
    void handleObu(c, parsed).catch((e) => {
      console.error("obu handler error", e);
      sendObu(c, { t: "toast", level: "error", text: "Server error - please retry." });
    });
  });

  ws.on("close", () => {
    if (c.socket === ws) onDisconnect(c);
  });
  ws.on("error", () => ws.terminate());
}

async function handleObu(c: ClientState, m: z.infer<typeof ObuMsg>) {
  switch (m.t) {
    case "ping":
      return sendObu(c, { t: "pong", serverNowMs: Date.now() });
    case "login": {
      const err = await login(c, m.forteId.trim(), m.pin.trim());
      if (err) return sendObu(c, { t: "login.err", reason: err });
      await sendInbox(c);
      sendObu(c, { t: "runs", runs: await listRuns(c) });
      return;
    }
    case "logout":
      return logout(c);
    case "panic":
      return panic(c);
    case "gps":
      return setGps(c, m.lat, m.lon, m.speedKmh);
    case "inbox.list":
      return sendInbox(c);
  }

  // Everything below needs a logged-in driver.
  if (!c.driver) return sendObu(c, { t: "toast", level: "error", text: "Log in first." });

  switch (m.t) {
    case "runs.list":
      return sendObu(c, { t: "runs", runs: await listRuns(c) });
    case "run.select": {
      const err = await selectRun(c, m.timetableId);
      if (err) sendObu(c, { t: "toast", level: "error", text: err });
      return;
    }
    case "run.end":
      return endRun(c, "driver");
    case "duty.log":
      await prisma.dutyLog.create({
        data: { clientId: c.clientId, driverId: c.driver.id, fuelLiters: m.fuelLiters ?? null, mileageKm: m.mileageKm ?? null, note: m.note ?? "" },
      });
      return sendObu(c, { t: "toast", level: "info", text: "Duty log saved." });
    case "door":
      return door(c, m.state);
    case "step.manual":
      return stepManual(c);
    case "message.send":
      return sendCanned(c, m.optionId);
    case "announce":
      return logAnnouncement(c, m.text);
    case "ack":
      return ackMessages(c, m.messageIds);
  }
}

// ------------------------------------------------------------------ dashboard
async function onDashConnection(ws: Alive) {
  ws.isAlive = true;
  ws.on("pong", () => (ws.isAlive = true));
  dashSockets.add(ws);
  ws.on("close", () => dashSockets.delete(ws));
  ws.on("error", () => ws.terminate());
  const snapshot: ServerToDash = {
    t: "snapshot",
    fleet: [...clients.values()].map(fleetRow),
    messages: await recentMessages(50),
  };
  ws.send(JSON.stringify(snapshot));
}
