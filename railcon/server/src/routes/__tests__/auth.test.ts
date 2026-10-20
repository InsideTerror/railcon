import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { authRoutes } from '../auth';
import prisma from '../../lib/prisma';
import bcrypt from 'bcryptjs';

describe('Auth Routes', () => {
  let app: ReturnType<typeof Fastify>;
  const testForteId = 'TEST001';
  const testPin = '123456';

  beforeAll(async () => {
    app = Fastify();
    await app.register(authRoutes, { prefix: '/api' });
    await app.ready();

    const pinHash = await bcrypt.hash(testPin, 10);
    await prisma.user.upsert({
      where: { forteId: testForteId },
      update: { pinHash, name: 'Test Driver', role: 'DRIVER' },
      create: { pinHash, forteId: testForteId, name: 'Test Driver', role: 'DRIVER' },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { forteId: testForteId } });
    await app.close();
  });

  it('should login with valid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { pin: testPin, forteId: testForteId },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.token).toBeDefined();
    expect(body.user.forteId).toBe(testForteId);
  });

  it('should reject invalid PIN', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { pin: '000000', forteId: testForteId },
    });

    expect(response.statusCode).toBe(401);
  });

  it('should reject invalid Forte ID', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { pin: testPin, forteId: 'INVALID' },
    });

    expect(response.statusCode).toBe(401);
  });
});
