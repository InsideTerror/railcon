import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/users', async () => {
    const users = await prisma.user.findMany({
      select: { id: true, forteId: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return { users };
  });

  app.post('/admin/users', async (request, reply) => {
    const schema = z.object({
      pin: z.string().length(6),
      forteId: z.string().min(1),
      name: z.string().min(1),
      role: z.enum(['DRIVER', 'DISPATCHER', 'SYSADMIN']).default('DRIVER'),
    });

    const { pin, forteId, name, role } = schema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { forteId } });
    if (existing) {
      return reply.code(400).send({ error: 'Forte ID already exists' });
    }

    const pinHash = await bcrypt.hash(pin, 10);

    const user = await prisma.user.create({
      data: { pinHash, forteId, name, role },
      select: { id: true, forteId: true, name: true, role: true, createdAt: true },
    });

    return { user };
  });

  app.put('/admin/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({
      name: z.string().optional(),
      role: z.enum(['DRIVER', 'DISPATCHER', 'SYSADMIN']).optional(),
      pin: z.string().length(6).optional(),
    });

    const data = schema.parse(request.body);

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.role) updateData.role = data.role;
    if (data.pin) updateData.pinHash = await bcrypt.hash(data.pin, 10);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, forteId: true, name: true, role: true, createdAt: true },
    });

    return { user };
  });

  app.delete('/admin/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.user.delete({ where: { id } });
    return { success: true };
  });
}
