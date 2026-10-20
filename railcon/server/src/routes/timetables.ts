import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

export async function timetableRoutes(app: FastifyInstance) {
  app.get('/timetables', async (request: FastifyRequest, _reply: FastifyReply) => {
    const { routeId, direction } = request.query as { routeId?: string; direction?: string };

    const where: any = {};
    if (routeId) where.routeId = routeId;
    if (direction) where.direction = parseInt(direction);

    const timetables = await prisma.timetable.findMany({
      where,
      include: {
        route: true,
        stops: {
          include: { station: true },
          orderBy: { stopSequenceIndex: 'asc' },
        },
      },
      orderBy: [{ routeId: 'asc' }, { runNumber: 'asc' }],
    });

    return { timetables };
  });

  app.get('/timetables/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const timetable = await prisma.timetable.findUnique({
      where: { id },
      include: {
        route: true,
        stops: {
          include: { station: true },
          orderBy: { stopSequenceIndex: 'asc' },
        },
      },
    });

    if (!timetable) {
      return reply.code(404).send({ error: 'Timetable not found' });
    }

    return { timetable };
  });

  app.post('/timetables', async (request: FastifyRequest, reply: FastifyReply) => {
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
      include: { stops: { include: { station: true } } },
    });

    return { timetable };
  });

  app.put('/timetables/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      runNumber: z.string().optional(),
      startTime: z.string().datetime().optional(),
      endTime: z.string().datetime().optional(),
      direction: z.number().int().min(1).max(2).optional(),
    });

    const data = schema.parse(request.body);

    const updateData: any = {};
    if (data.runNumber) updateData.runNumber = data.runNumber;
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);
    if (data.direction) updateData.direction = data.direction;

    const timetable = await prisma.timetable.update({
      where: { id },
      data: updateData,
      include: { stops: { include: { station: true } } },
    });

    return { timetable };
  });

  app.delete('/timetables/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await prisma.timetable.delete({ where: { id } });
    return { success: true };
  });
}
