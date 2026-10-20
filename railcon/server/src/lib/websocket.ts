import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { verifyToken, JWTPayload } from './auth';
import prisma from './prisma';

interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
  clientId?: string;
}

const connectedClients = new Map<string, AuthenticatedSocket>();

export function initializeWebSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
    path: '/ws',
  });

  io.use(async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (typeof token !== 'string') {
      return next(new Error('Authentication required'));
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid token'));
    }

    socket.user = payload;
    next();
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`Client connected: ${socket.user?.forteId} (${socket.id})`);

    socket.on('register-client', async (clientId: string) => {
      socket.clientId = clientId;
      connectedClients.set(clientId, socket);

      await prisma.activeSession.update({
        where: { clientId },
        data: { status: 'ACTIVE' },
      }).catch(() => {});

      broadcastFleetUpdate();
    });

    socket.on('update-position', async (data: { stopIndex: number; delayMinutes: number }) => {
      if (!socket.clientId) return;

      await prisma.activeSession.update({
        where: { clientId: socket.clientId },
        data: {
          currentStopIndex: data.stopIndex,
          delayMinutes: data.delayMinutes,
        },
      }).catch(() => {});

      broadcastFleetUpdate();
    });

    socket.on('send-message', async (data: { receiverClientId: string; content: string; type: string }) => {
      if (!socket.user) return;

      const message = await prisma.message.create({
        data: {
          senderId: socket.user.sub,
          receiverClientId: data.receiverClientId,
          content: data.content,
          type: data.type as any,
        },
      });

      const receiverSocket = connectedClients.get(data.receiverClientId);
      if (receiverSocket) {
        receiverSocket.emit('new-message', message);
      }

      socket.emit('message-sent', message);
    });

    socket.on('acknowledge-message', async (messageId: string) => {
      await prisma.message.update({
        where: { id: messageId },
        data: { acknowledged: true },
      }).catch(() => {});
    });

    socket.on('panic', async () => {
      if (!socket.user || !socket.clientId) return;

      await prisma.message.create({
        data: {
          senderId: socket.user.sub,
          receiverClientId: 'DISPATCHER',
          content: `PANIC ALERT from ${socket.user.name} (${socket.user.forteId})`,
          type: 'PANIC',
        },
      });

      for (const [, clientSocket] of connectedClients) {
        if (clientSocket.user?.role === 'DISPATCHER' || clientSocket.user?.role === 'SYSADMIN') {
          clientSocket.emit('panic-alert', {
            clientId: socket.clientId,
            driverName: socket.user.name,
            driverId: socket.user.forteId,
            timestamp: new Date(),
          });
        }
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.user?.forteId} (${socket.id})`);
      if (socket.clientId) {
        connectedClients.delete(socket.clientId);
        await prisma.activeSession.update({
          where: { clientId: socket.clientId },
          data: { status: 'NON_ACTIVE' },
        }).catch(() => {});
        broadcastFleetUpdate();
      }
    });
  });

  return io;
}

export function broadcastFleetUpdate() {
  // This will be called periodically or on events
  // Implementation will fetch active sessions and broadcast
}

export function getConnectedClients() {
  return connectedClients;
}

export function sendToClient(clientId: string, event: string, data: any) {
  const socket = connectedClients.get(clientId);
  if (socket) {
    socket.emit(event, data);
  }
}

export function broadcastToRole(role: string, event: string, data: any) {
  for (const [, socket] of connectedClients) {
    if (socket.user?.role === role) {
      socket.emit(event, data);
    }
  }
}
