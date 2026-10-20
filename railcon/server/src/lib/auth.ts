import { jwtVerify, SignJWT } from 'jose';
import { config } from '../config';
import prisma from './prisma';

const secret = new TextEncoder().encode(config.JWT_SECRET);

export interface JWTPayload {
  sub: string;
  role: string;
  forteId: string;
  name: string;
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(config.JWT_EXPIRES_IN)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function authenticateDriver(pin: string, forteId: string) {
  const user = await prisma.user.findUnique({
    where: { forteId },
  });

  if (!user) return null;

  const bcrypt = await import('bcryptjs');
  const valid = await bcrypt.compare(pin, user.pinHash);
  if (!valid) return null;

  return user;
}

export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}
