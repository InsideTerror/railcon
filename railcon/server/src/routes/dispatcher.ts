import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { broadcastToRole, sendToClient } from '../lib/websocket';

export async function dispatcherRoutes(app: FastifyInstance) {
  app.get('/dispatcher/fleet', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const sessions = await prisma.activeSession.findMany({
      include: {
        driver: { select: { id: true, name: true, forteId: true, role: true } },
        timetable: {
          include: {
            route: true,
            stops: {
              include: { station: true },
              orderBy: { stopSequenceIndex: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const active = sessions.filter((s: any) => s.status === 'ACTIVE');
    const idle = sessions.filter((s: any) => s.status === 'IDLE');
    const nonActive = sessions.filter((s: any) => s.status === 'NON_ACTIVE');

    return { active, idle, nonActive, total: sessions.length };
  });

  app.post('/dispatcher/broadcast', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      clientIds: z.array(z.string()).optional(),
      role: z.enum(['DRIVER', 'DISPATCHER', 'SYSADMIN']).optional(),
      content: z.string().min(1),
      type: z.enum(['STATUS', 'DISPATCH_POPUP', 'PANIC']).default('DISPATCH_POPUP'),
      duration: z.number().int().positive().default(10000),
    });

    const { clientIds, role, content, type, duration } = schema.parse(request.body);

    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let senderId: string | undefined;
    if (token) {
      const { verifyToken } = await import('../lib/auth.js');
      const payload = await verifyToken(token);
      if (payload) senderId = payload.sub;
    }

    const message = await prisma.message.create({
      data: { senderId, receiverClientId: 'BROADCAST', content, type },
    });

    if (clientIds && clientIds.length > 0) {
      for (const clientId of clientIds) {
        const msg = await prisma.message.create({
          data: { senderId, receiverClientId: clientId, content, type },
        });
        sendToClient(clientId, 'dispatch-popup', { message: msg, duration });
      }
    } else if (role) {
      broadcastToRole(role, 'dispatch-popup', { message, duration });
    }

    return { success: true, message };
  });

  app.post('/dispatcher/truncate-stops', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      clientId: z.string().min(1),
      newStopIndex: z.number().int().min(0),
    });

    const { clientId, newStopIndex } = schema.parse(request.body);

    const session = await prisma.activeSession.findUnique({
      where: { clientId },
      include: { timetable: { include: { stops: true } } },
    });

    if (!session || !session.timetable) {
      return reply.code(400).send({ error: 'No active timetable' });
    }

    if (newStopIndex >= session.timetable.stops.length) {
      return reply.code(400).send({ error: 'Invalid stop index' });
    }

    await prisma.activeSession.update({
      where: { clientId },
      data: { currentStopIndex: newStopIndex },
    });

    sendToClient(clientId, 'stops-truncated', { newStopIndex });
    broadcastToRole('DISPATCHER', 'fleet-update', { type: 'STOPS_TRUNCATED', clientId, newStopIndex });

    return { success: true };
  });

  app.post('/dispatcher/schedule-override', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      clientId: z.string().min(1),
      delayMinutes: z.number().int(),
    });

    const { clientId, delayMinutes } = schema.parse(request.body);

    await prisma.activeSession.update({
      where: { clientId },
      data: { delayMinutes },
    });

    sendToClient(clientId, 'schedule-override', { delayMinutes });
    broadcastToRole('DISPATCHER', 'fleet-update', { type: 'SCHEDULE_OVERRIDE', clientId, delayMinutes });

    return { success: true };
  });

  app.post('/dispatcher/relief-run', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      routeId: z.string().min(1),
      runNumber: z.string().min(1),
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
      direction: z.number().int().min(1).max(2),
      stops: z.array(z.object({
        stationId: z.string(),
        stopSequenceIndex: z.number().int().min(1),
        scheduledArrival: z.string().datetime().optional(),
        scheduledDeparture: z.string().datetime().optional(),
      })),
    });

    const { routeId, runNumber, startTime, endTime, direction, stops } = schema.parse(request.body);

    const timetable = await prisma.timetable.create({
      data: {
        routeId,
        runNumber,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        direction,
        stops: {
          create: stops.map((s: any) => ({
            stationId: s.stationId,
            stopSequenceIndex: s.stopSequenceIndex,
            scheduledArrival: s.scheduledArrival ? new Date(s.scheduledArrival) : null,
            scheduledDeparture: s.scheduledDeparture ? new Date(s.scheduledDeparture) : null,
          })),
        },
      },
      include: { route: true, stops: { include: { station: true } } },
    });

    broadcastToRole('DISPATCHER', 'fleet-update', { type: 'RELIEF_RUN_CREATED', timetable });

    return { timetable };
  });

  app.post('/dispatcher/terminate-session', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      clientId: z.string().min(1),
    });

    const { clientId } = schema.parse(request.body);

    await prisma.activeSession.update({
      where: { clientId },
      data: { driverId: null, timetableId: null, status: 'NON_ACTIVE', currentStopIndex: 0, delayMinutes: 0 },
    });

    sendToClient(clientId, 'session-terminated', { clientId });
    broadcastToRole('DISPATCHER', 'fleet-update', { type: 'SESSION_TERMINATED', clientId });

    return { success: true };
  });
}
