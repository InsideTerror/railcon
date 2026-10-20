import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

export async function stationRoutes(app: FastifyInstance) {
  app.get('/stations', async () => {
    const stations = await prisma.station.findMany({
      orderBy: { name: 'asc' },
    });
    return { stations };
  });

  app.get('/stations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const station = await prisma.station.findUnique({
      where: { id },
      include: {
        routeStops: { include: { route: true } },
        timetableStops: { include: { timetable: { include: { route: true } } } },
      },
    });

    if (!station) {
      return reply.code(404).send({ error: 'Station not found' });
    }

    return { station };
  });

  app.post('/stations', async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      code: z.string().min(1).max(10),
    });

    const { name, code } = schema.parse(request.body);

    const station = await prisma.station.create({
      data: { name, code },
    });

    return { station };
  });

  app.put('/stations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().optional(),
      code: z.string().min(1).max(10).optional(),
    });

    const data = schema.parse(request.body);

    const station = await prisma.station.update({
      where: { id },
      data,
    });

    return { station };
  });

  app.delete('/stations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.station.delete({ where: { id } });
    return { success: true };
  });
}
