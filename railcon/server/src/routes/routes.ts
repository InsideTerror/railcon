import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';

export async function routeRoutes(app: FastifyInstance) {
  app.get('/routes', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const routes = await prisma.route.findMany({
      include: {
        stops: {
          include: { station: true },
          orderBy: { stopSequenceIndex: 'asc' },
        },
        timetables: {
          include: {
            stops: {
              include: { station: true },
              orderBy: { stopSequenceIndex: 'asc' },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
    return { routes };
  });

  app.get('/routes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const route = await prisma.route.findUnique({
      where: { id },
      include: {
        stops: {
          include: { station: true },
          orderBy: { stopSequenceIndex: 'asc' },
        },
        timetables: {
          include: {
            stops: {
              include: { station: true },
              orderBy: { stopSequenceIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!route) {
      return reply.code(404).send({ error: 'Route not found' });
    }

    return { route };
  });

  app.post('/routes', async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      stops: z.array(z.object({
        stationId: z.string(),
        stopSequenceIndex: z.number().int().min(1),
      })).optional(),
    });

    const { id, name, description, stops } = schema.parse(request.body);

    const route = await prisma.route.create({
      data: {
        id,
        name,
        description,
        stops: stops ? {
          create: stops.map((s: any) => ({
            stationId: s.stationId,
            stopSequenceIndex: s.stopSequenceIndex,
          })),
        } : undefined,
      },
      include: { stops: { include: { station: true } } },
    });

    return { route };
  });

  app.put('/routes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
    });

    const data = schema.parse(request.body);

    const route = await prisma.route.update({
      where: { id },
      data,
      include: { stops: { include: { station: true } } },
    });

    return { route };
  });

  app.delete('/routes/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await prisma.route.delete({ where: { id } });
    return { success: true };
  });
}
