import Fastify from 'fastify';
import { config } from './config';
import { initializeWebSocket } from './lib/websocket';
import { authRoutes } from './routes/auth';
import { sessionRoutes } from './routes/sessions';
import { messageRoutes } from './routes/messages';
import { routeRoutes } from './routes/routes';
import { timetableRoutes } from './routes/timetables';
import { stationRoutes } from './routes/stations';
import { dispatcherRoutes } from './routes/dispatcher';
import { gtfsRoutes } from './routes/gtfs';
import { adminRoutes } from './routes/admin';
import { createServer } from 'http';
import { startPISServer } from './pis/server';

async function main() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
    },
  });

  await app.register(import('@fastify/cors'), {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(import('@fastify/websocket'));

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/api' });
  await app.register(sessionRoutes, { prefix: '/api' });
  await app.register(messageRoutes, { prefix: '/api' });
  await app.register(routeRoutes, { prefix: '/api' });
  await app.register(timetableRoutes, { prefix: '/api' });
  await app.register(stationRoutes, { prefix: '/api' });
  await app.register(dispatcherRoutes, { prefix: '/api' });
  await app.register(gtfsRoutes, { prefix: '/api' });
  await app.register(adminRoutes, { prefix: '/api' });

  const httpServer = createServer(app.server);

  initializeWebSocket(httpServer);

  startPISServer(config.PIS_PORT);

  try {
    await httpServer.listen({ port: config.PORT, host: config.HOST });
    console.log(`🚂 RailCon Server running on http://${config.HOST}:${config.PORT}`);
    console.log(`📡 WebSocket server on ws://${config.HOST}:${config.PORT}/ws`);
    console.log(`🖥️  PIS Server on http://${config.HOST}:${config.PIS_PORT}/passenger-display`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
