import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { getConnectedClients, sendToClient, broadcastToRole } from '../lib/websocket';

export async function sessionRoutes(app: FastifyInstance) {
  app.get('/sessions', async () => {
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

    return { sessions };
  });

  app.get('/sessions/:clientId', async (request, reply) => {
    const { clientId } = request.params as { clientId: string };

    const session = await prisma.activeSession.findUnique({
      where: { clientId },
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
    });

    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    return { session };
  });

  app.patch('/sessions/:clientId', async (request, reply) => {
    const { clientId } = request.params as { clientId: string };
    const schema = z.object({
      driverId: z.string().optional(),
      timetableId: z.string().optional(),
      currentStopIndex: z.number().int().min(0).optional(),
      delayMinutes: z.number().int().optional(),
      status: z.enum(['ACTIVE', 'IDLE', 'NON_ACTIVE']).optional(),
    });

    const data = schema.parse(request.body);

    const session = await prisma.activeSession.update({
      where: { clientId },
      data,
      include: {
        driver: { select: { id: true, name: true, forteId: true, role: true } },
        timetable: { include: { route: true } },
      },
    });

    const socket = getConnectedClients().get(clientId);
    if (socket) {
      socket.emit('session-updated', session);
    }

    broadcastToRole('DISPATCHER', 'fleet-update', { type: 'SESSION_UPDATED', session });

    return { session };
  });

  app.delete('/sessions/:clientId', async (request, reply) => {
    const { clientId } = request.params as { clientId: string };

    await prisma.activeSession.update({
      where: { clientId },
      data: { driverId: null, timetableId: null, status: 'NON_ACTIVE', currentStopIndex: 0, delayMinutes: 0 },
    });

    const socket = getConnectedClients().get(clientId);
    if (socket) {
      socket.emit('session-terminated', { clientId });
    }

    broadcastToRole('DISPATCHER', 'fleet-update', { type: 'SESSION_TERMINATED', clientId });

    return { success: true };
  });

  app.post('/sessions/:clientId/advance-stop', async (request, reply) => {
    const { clientId } = request.params as { clientId: string };

    const session = await prisma.activeSession.findUnique({
      where: { clientId },
      include: { timetable: { include: { stops: true } } },
    });

    if (!session || !session.timetable) {
      return reply.code(400).send({ error: 'No active timetable' });
    }

    const nextIndex = session.currentStopIndex + 1;
    const maxIndex = session.timetable.stops.length - 1;

    if (nextIndex > maxIndex) {
      return reply.code(400).send({ error: 'Already at final stop' });
    }

    const updated = await prisma.activeSession.update({
      where: { clientId },
      data: { currentStopIndex: nextIndex },
    });

    const socket = getConnectedClients().get(clientId);
    if (socket) {
      socket.emit('stop-advanced', { stopIndex: nextIndex });
    }

    broadcastToRole('DISPATCHER', 'fleet-update', { type: 'STOP_ADVANCED', clientId, stopIndex: nextIndex });

    return { session: updated };
  });

  app.post('/sessions/:clientId/door-toggle', async (request, reply) => {
    const { clientId } = request.params as { clientId: string };
    const schema = z.object({ doorOpen: z.boolean() });
    const { doorOpen } = schema.parse(request.body);

    const socket = getConnectedClients().get(clientId);
    if (socket) {
      socket.emit('door-state-changed', { doorOpen });
    }

    return { success: true, doorOpen };
  });
}
