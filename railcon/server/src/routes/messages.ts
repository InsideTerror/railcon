import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { sendToClient, broadcastToRole } from '../lib/websocket';

export async function messageRoutes(app: FastifyInstance) {
  app.get('/messages', async (request) => {
    const { clientId, type, limit = '50', offset = '0' } = request.query as {
      clientId?: string;
      type?: string;
      limit?: string;
      offset?: string;
    };

    const where: any = {};
    if (clientId) where.receiverClientId = clientId;
    if (type) where.type = type;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: { sender: { select: { id: true, name: true, forteId: true } } },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
      }),
      prisma.message.count({ where }),
    ]);

    return { messages, total };
  });

  app.post('/messages', async (request, reply) => {
    const schema = z.object({
      receiverClientId: z.string().min(1),
      content: z.string().min(1),
      type: z.enum(['STATUS', 'DISPATCH_POPUP', 'PANIC']),
    });

    const { receiverClientId, content, type } = schema.parse(request.body);

    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    let senderId: string | undefined;
    if (token) {
      const { verifyToken } = await import('../lib/auth.js');
      const payload = await verifyToken(token);
      if (payload) senderId = payload.sub;
    }

    const message = await prisma.message.create({
      data: { senderId, receiverClientId, content, type },
      include: { sender: { select: { id: true, name: true, forteId: true } } },
    });

    sendToClient(receiverClientId, 'new-message', message);
    broadcastToRole('DISPATCHER', 'message-queued', { message, receiverClientId });

    return { message };
  });

  app.patch('/messages/:id/acknowledge', async (request, reply) => {
    const { id } = request.params as { id: string };

    const message = await prisma.message.update({
      where: { id },
      data: { acknowledged: true },
    });

    return { message };
  });

  app.get('/canned-options', async () => {
    const options = await prisma.cannedOption.findMany({
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    });
    return { options };
  });
}
