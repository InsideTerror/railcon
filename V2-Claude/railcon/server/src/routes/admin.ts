import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { hashPin, PIN_RE } from "../auth.js";
import { requireRole } from "./auth.js";
import { fmtHms, parseHms } from "../time.js";
import { importGtfs } from "../ingest/gtfs.js";
import { importCsv } from "../ingest/csv.js";

const timeStr = z.string().regex(/^\d{1,3}:\d{2}(:\d{2})?$/, "Use HH:MM or HH:MM:SS");
const pin = z.string().regex(PIN_RE, "PIN must be 6-8 digits");

export async function adminRoutes(app: FastifyInstance) {
  const guard = { preHandler: requireRole("SYSADMIN") };
  const idParam = z.object({ id: z.coerce.number().int() });
  const strId = z.object({ id: z.string().min(1) });

  // ------------------------------------------------------------ users
  const userSelect = { id: true, forteId: true, name: true, role: true, createdAt: true } as const;

  app.get("/api/admin/users", guard, async () => prisma.user.findMany({ select: userSelect, orderBy: { forteId: "asc" } }));

  app.post("/api/admin/users", guard, async (req, reply) => {
    const b = z
      .object({ forteId: z.string().min(1).max(16), name: z.string().min(1).max(80), role: z.enum(["DRIVER", "DISPATCHER", "SYSADMIN"]), pin })
      .parse(req.body);
    const row = await prisma.user.create({ data: { forteId: b.forteId, name: b.name, role: b.role, pinHash: hashPin(b.pin) }, select: userSelect });
    return reply.code(201).send(row);
  });

  app.put("/api/admin/users/:id", guard, async (req) => {
    const { id } = idParam.parse(req.params);
    const b = z
      .object({ forteId: z.string().min(1).max(16).optional(), name: z.string().min(1).max(80).optional(), role: z.enum(["DRIVER", "DISPATCHER", "SYSADMIN"]).optional(), pin: pin.optional() })
      .parse(req.body);
    const { pin: newPin, ...rest } = b;
    return prisma.user.update({ where: { id }, data: { ...rest, ...(newPin ? { pinHash: hashPin(newPin) } : {}) }, select: userSelect });
  });

  app.delete("/api/admin/users/:id", guard, async (req, reply) => {
    const { id } = idParam.parse(req.params);
    if (id === req.user.uid) return reply.code(400).send({ error: "You cannot delete your own account" });
    await prisma.user.delete({ where: { id } });
    return { ok: true };
  });

  // ------------------------------------------------------------ stations
  const stationBody = z.object({
    name: z.string().min(1).max(120),
    code: z.string().min(1).max(24),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lon: z.number().min(-180).max(180).nullable().optional(),
  });
  app.get("/api/admin/stations", guard, async () => prisma.station.findMany({ orderBy: { name: "asc" } }));
  app.post("/api/admin/stations", guard, async (req, reply) => reply.code(201).send(await prisma.station.create({ data: stationBody.parse(req.body) })));
  app.put("/api/admin/stations/:id", guard, async (req) => {
    const { id } = idParam.parse(req.params);
    return prisma.station.update({ where: { id }, data: stationBody.partial().parse(req.body) });
  });
  app.delete("/api/admin/stations/:id", guard, async (req) => {
    const { id } = idParam.parse(req.params);
    await prisma.station.delete({ where: { id } });
    return { ok: true };
  });

  // ------------------------------------------------------------ routes (+ canonical stop list)
  const routeBody = z.object({
    id: z.string().min(1).max(24),
    name: z.string().min(1).max(120),
    description: z.string().max(500).default(""),
    stationIds: z.array(z.number().int()).optional(), // ordered => stop_sequence_index 1..N
  });
  const routeOut = (r: { id: string; name: string; description: string; stops: { stationId: number; stopSequenceIndex: number; station: { name: string } }[] }) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    stops: r.stops.map((s) => ({ stationId: s.stationId, name: s.station.name, index: s.stopSequenceIndex })),
  });
  const routeInclude = { stops: { include: { station: true }, orderBy: { stopSequenceIndex: "asc" as const } } };

  app.get("/api/admin/routes", guard, async () => (await prisma.route.findMany({ orderBy: { id: "asc" }, include: routeInclude })).map(routeOut));

  app.post("/api/admin/routes", guard, async (req, reply) => {
    const b = routeBody.parse(req.body);
    await prisma.route.create({
      data: {
        id: b.id,
        name: b.name,
        description: b.description,
        stops: { create: (b.stationIds ?? []).map((stationId, i) => ({ stationId, stopSequenceIndex: i + 1 })) },
      },
    });
    return reply.code(201).send(routeOut(await prisma.route.findUniqueOrThrow({ where: { id: b.id }, include: routeInclude })));
  });

  app.put("/api/admin/routes/:id", guard, async (req) => {
    const { id } = strId.parse(req.params);
    const b = routeBody.omit({ id: true }).partial().parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.route.update({ where: { id }, data: { name: b.name, description: b.description } });
      if (b.stationIds) {
        await tx.routeStop.deleteMany({ where: { routeId: id } });
        await tx.routeStop.createMany({ data: b.stationIds.map((stationId, i) => ({ routeId: id, stationId, stopSequenceIndex: i + 1 })) });
      }
    });
    return routeOut(await prisma.route.findUniqueOrThrow({ where: { id }, include: routeInclude }));
  });

  app.delete("/api/admin/routes/:id", guard, async (req) => {
    const { id } = strId.parse(req.params);
    await prisma.route.delete({ where: { id } });
    return { ok: true };
  });

  // ------------------------------------------------------------ timetables
  const ttBody = z.object({
    routeId: z.string().min(1),
    runNumber: z.string().min(1).max(24),
    direction: z.union([z.literal(1), z.literal(2)]).default(1),
    stops: z
      .array(z.object({ stationId: z.number().int(), arrival: timeStr, departure: timeStr }))
      .min(2, "A timetable needs at least 2 stops"),
  });
  const ttInclude = { stops: { include: { station: true }, orderBy: { stopSequenceIndex: "asc" as const } } };
  const ttOut = (t: Prisma.TimetableGetPayload<{ include: typeof ttInclude }>) => ({
    id: t.id,
    routeId: t.routeId,
    runNumber: t.runNumber,
    direction: t.direction,
    isRelief: t.isRelief,
    startTime: fmtHms(t.startTime),
    endTime: fmtHms(t.endTime),
    stops: t.stops.map((s) => ({
      index: s.stopSequenceIndex,
      stationId: s.stationId,
      name: s.station.name,
      arrival: fmtHms(s.scheduledArrival),
      departure: fmtHms(s.scheduledDeparture),
    })),
  });
  const ttData = (b: z.infer<typeof ttBody>) => {
    const stops = b.stops.map((s, i) => ({
      stationId: s.stationId,
      stopSequenceIndex: i + 1,
      scheduledArrival: parseHms(s.arrival),
      scheduledDeparture: parseHms(s.departure),
    }));
    return { stops, startTime: stops[0].scheduledDeparture, endTime: stops[stops.length - 1].scheduledArrival };
  };

  app.get("/api/admin/timetables", guard, async (req) => {
    const q = z.object({ routeId: z.string().optional() }).parse(req.query);
    const rows = await prisma.timetable.findMany({
      where: q.routeId ? { routeId: q.routeId } : {},
      orderBy: [{ routeId: "asc" }, { startTime: "asc" }],
      take: 1000,
      include: { _count: { select: { stops: true } } },
    });
    return rows.map((t) => ({
      id: t.id,
      routeId: t.routeId,
      runNumber: t.runNumber,
      direction: t.direction,
      isRelief: t.isRelief,
      startTime: fmtHms(t.startTime),
      endTime: fmtHms(t.endTime),
      stopCount: t._count.stops,
    }));
  });

  app.get("/api/admin/timetables/:id", guard, async (req) => {
    const { id } = idParam.parse(req.params);
    return ttOut(await prisma.timetable.findUniqueOrThrow({ where: { id }, include: ttInclude }));
  });

  app.post("/api/admin/timetables", guard, async (req, reply) => {
    const b = ttBody.parse(req.body);
    const d = ttData(b);
    const created = await prisma.timetable.create({
      data: { routeId: b.routeId, runNumber: b.runNumber, direction: b.direction, startTime: d.startTime, endTime: d.endTime, stops: { create: d.stops } },
    });
    return reply.code(201).send(ttOut(await prisma.timetable.findUniqueOrThrow({ where: { id: created.id }, include: ttInclude })));
  });

  app.put("/api/admin/timetables/:id", guard, async (req) => {
    const { id } = idParam.parse(req.params);
    const b = ttBody.parse(req.body);
    const d = ttData(b);
    await prisma.$transaction(async (tx) => {
      await tx.timetableStop.deleteMany({ where: { timetableId: id } });
      await tx.timetable.update({
        where: { id },
        data: { routeId: b.routeId, runNumber: b.runNumber, direction: b.direction, startTime: d.startTime, endTime: d.endTime, stops: { create: d.stops } },
      });
    });
    return ttOut(await prisma.timetable.findUniqueOrThrow({ where: { id }, include: ttInclude }));
  });

  app.delete("/api/admin/timetables/:id", guard, async (req) => {
    const { id } = idParam.parse(req.params);
    await prisma.timetable.delete({ where: { id } });
    return { ok: true };
  });

  // ------------------------------------------------------------ canned options
  const cannedBody = z.object({
    category: z.enum(["DRIVER_TO_DISPATCH", "PASSENGER_ANNOUNCEMENT"]),
    label: z.string().min(1).max(60),
    templateText: z.string().min(1).max(300),
    displayOrder: z.number().int().default(0),
  });
  app.get("/api/admin/canned", guard, async () => prisma.cannedOption.findMany({ orderBy: [{ category: "asc" }, { displayOrder: "asc" }] }));
  app.post("/api/admin/canned", guard, async (req, reply) => reply.code(201).send(await prisma.cannedOption.create({ data: cannedBody.parse(req.body) })));
  app.put("/api/admin/canned/:id", guard, async (req) => {
    const { id } = idParam.parse(req.params);
    return prisma.cannedOption.update({ where: { id }, data: cannedBody.partial().parse(req.body) });
  });
  app.delete("/api/admin/canned/:id", guard, async (req) => {
    const { id } = idParam.parse(req.params);
    await prisma.cannedOption.delete({ where: { id } });
    return { ok: true };
  });

  // ------------------------------------------------------------ data ingestion
  // multipart/form-data: put text fields BEFORE the file field.
  app.post("/api/admin/import/gtfs", guard, async (req, reply) => {
    if (!req.isMultipart()) return reply.code(400).send({ error: "Send the GTFS .zip as multipart/form-data (field name: file)" });
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "No file uploaded" });
    const field = (n: string) => (file.fields[n] as { value?: string } | undefined)?.value;
    const buf = await file.toBuffer();
    try {
      return await importGtfs(new Uint8Array(buf), {
        serviceId: field("serviceId") || undefined,
        maxTrips: field("maxTrips") ? Number(field("maxTrips")) : undefined,
        replace: field("replace") !== "false",
      });
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });

  app.post("/api/admin/import/csv", guard, async (req, reply) => {
    let text: string;
    if (req.isMultipart()) {
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: "No file uploaded" });
      text = (await file.toBuffer()).toString("utf8");
    } else {
      text = z.object({ text: z.string().min(1) }).parse(req.body).text;
    }
    try {
      return await importCsv(text);
    } catch (e) {
      return reply.code(400).send({ error: (e as Error).message });
    }
  });
}
