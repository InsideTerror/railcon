import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateDriver, createToken, JWTPayload } from '../lib/auth';
import prisma from '../lib/prisma';

const loginSchema = z.object({
  pin: z.string().length(6, 'PIN must be 6 digits'),
  forteId: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (request, reply) => {
    const { pin, forteId } = loginSchema.parse(request.body);

    const user = await authenticateDriver(pin, forteId);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = await createToken({
      sub: user.id,
      role: user.role,
      forteId: user.forteId,
      name: user.name,
    });

    return { token, user: { id: user.id, name: user.name, forteId: user.forteId, role: user.role } };
  });

  app.get('/auth/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { verifyToken } = await import('../lib/auth');
    const payload = await verifyToken(token);
    if (!payload) {
      return reply.code(401).send({ error: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, forteId: true, role: true },
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return { user };
  });

  app.post('/auth/register-client', async (request, reply) => {
    const schema = z.object({
      clientId: z.string().min(1),
      driverId: z.string().optional(),
      timetableId: z.string().optional(),
    });

    const { clientId, driverId, timetableId } = schema.parse(request.body);

    const session = await prisma.activeSession.upsert({
      where: { clientId },
      update: {
        driverId,
        timetableId,
        status: driverId && timetableId ? 'ACTIVE' : 'IDLE',
      },
      create: {
        clientId,
        driverId,
        timetableId,
        status: driverId && timetableId ? 'ACTIVE' : 'IDLE',
      },
    });

    return { session };
  });
}
