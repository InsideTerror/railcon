import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireRole } from "./auth.js";
import { clients, fleetRow } from "../state.js";
import { fmtHms } from "../time.js";
import { ackPanic, cmdOverride, cmdPopup, cmdRelief, cmdTerminate, cmdTruncate, recentMessages } from "../engine.js";

export async function dispatchRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRole("DISPATCHER", "SYSADMIN") };

  app.get("/api/dispatch/fleet", guard, async () => [...clients.values()].map(fleetRow));

  app.get("/api/dispatch/messages", guard, async (req) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
    return recentMessages(limit);
  });

  app.post("/api/dispatch/messages/:id/ack", guard, async (req) => {
    const { id } = z.object({ id: z.coerce.number().int() }).parse(req.params);
    await ackPanic(id);
    return { ok: true };
  });

  const clientParam = z.object({ clientId: z.string().min(1) });

  // Truncate / cancel the remaining stations: the run now terminates at `afterStopIndex`
  // (default: the current stop). Passing the last index restores the full run.
  app.post("/api/dispatch/clients/:clientId/truncate", guard, async (req) => {
    const { clientId } = clientParam.parse(req.params);
    const body = z.object({ afterStopIndex: z.number().int().min(1).optional() }).parse(req.body ?? {});
    cmdTruncate(clientId, body.afterStopIndex);
    return { ok: true };
  });

  // Schedule override: DELAY = force the displayed offset, SHIFT = move the remaining timetable
  app.post("/api/dispatch/clients/:clientId/override", guard, async (req) => {
    const { clientId } = clientParam.parse(req.params);
    const body = z.object({ mode: z.enum(["DELAY", "SHIFT"]), minutes: z.number().min(-240).max(240) }).parse(req.body);
    cmdOverride(clientId, body.mode, body.minutes);
    return { ok: true };
  });

  // Remote session terminate: force logout of the driver, the route, or both
  app.post("/api/dispatch/clients/:clientId/terminate", guard, async (req) => {
    const { clientId } = clientParam.parse(req.params);
    const body = z.object({ target: z.enum(["DRIVER", "ROUTE", "BOTH"]) }).parse(req.body);
    cmdTerminate(clientId, body.target);
    return { ok: true };
  });

  // Broadcast pop-ups (shown for 10 s on the target OBUs)
  app.post("/api/dispatch/popup", guard, async (req) => {
    const body = z
      .object({ clientIds: z.union([z.literal("ALL"), z.array(z.string()).min(1)]), content: z.string().min(1).max(300) })
      .parse(req.body);
    const sent = await cmdPopup(body.clientIds, body.content, req.user.uid || null);
    return { ok: true, sent };
  });

  // Inject an extra / relief run (clone of an existing timetable, optionally shifted and assigned)
  app.post("/api/dispatch/relief", guard, async (req) => {
    const body = z
      .object({
        baseTimetableId: z.number().int(),
        runNumber: z.string().min(1).max(24).optional(),
        shiftMinutes: z.number().min(-720).max(720).default(0),
        clientId: z.string().optional(),
      })
      .parse(req.body);
    return cmdRelief(body);
  });

  // Helper lists for the dashboard forms
  app.get("/api/dispatch/timetables", guard, async (req) => {
    const q = z.object({ routeId: z.string().optional() }).parse(req.query);
    const rows = await prisma.timetable.findMany({
      where: q.routeId ? { routeId: q.routeId } : {},
      orderBy: [{ routeId: "asc" }, { startTime: "asc" }],
      take: 500,
      include: { stops: { include: { station: true }, orderBy: { stopSequenceIndex: "asc" } } },
    });
    return rows.map((t) => ({
      id: t.id,
      routeId: t.routeId,
      runNumber: t.runNumber,
      direction: t.direction,
      isRelief: t.isRelief,
      label: `${t.routeId} / ${t.runNumber}  ${fmtHms(t.startTime).slice(0, 5)} ${t.stops[0]?.station.name ?? ""} → ${t.stops[t.stops.length - 1]?.station.name ?? ""}`,
    }));
  });
}
