import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";
import { z } from "zod";
import { clearFailures, isLocked, recordFailure, verifyAdminKey, verifyUser } from "../auth.js";

export interface JwtUser {
  uid: number;
  forteId: string;
  name: string;
  role: Role;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Authentication required" });
    }
    if (!roles.includes(req.user.role)) return reply.code(403).send({ error: "Insufficient permissions" });
  };
}

export async function authRoutes(app: FastifyInstance) {
  // Dispatcher dashboard login
  app.post("/api/auth/login", async (req, reply) => {
    const body = z.object({ forteId: z.string().min(1).max(16), pin: z.string().min(1).max(16) }).parse(req.body);
    const lock = `web:${req.ip}:${body.forteId}`;
    if (isLocked(lock)) return reply.code(429).send({ error: "Too many failed attempts. Try again in 5 minutes." });
    const user = await verifyUser(body.forteId, body.pin, ["DISPATCHER", "SYSADMIN"]);
    if (!user) {
      recordFailure(lock);
      return reply.code(401).send({ error: "Invalid ID or PIN" });
    }
    clearFailures(lock);
    const payload: JwtUser = { uid: user.id, forteId: user.forteId, name: user.name, role: user.role };
    return { token: app.jwt.sign(payload, { expiresIn: "12h" }), user: payload };
  });

  // Sysadmin portal: unlocked by the sysadmin key / PIN only
  app.post("/api/auth/admin", async (req, reply) => {
    const body = z.object({ key: z.string().min(1).max(128) }).parse(req.body);
    const lock = `admin:${req.ip}`;
    if (isLocked(lock)) return reply.code(429).send({ error: "Too many failed attempts. Try again in 5 minutes." });
    const user = await verifyAdminKey(body.key);
    if (!user) {
      recordFailure(lock);
      return reply.code(401).send({ error: "Invalid administrator key" });
    }
    clearFailures(lock);
    const payload: JwtUser = { uid: user.id, forteId: user.forteId, name: user.name, role: "SYSADMIN" };
    return { token: app.jwt.sign(payload, { expiresIn: "8h" }), user: payload };
  });

  app.get("/api/auth/me", { preHandler: requireRole("DISPATCHER", "SYSADMIN") }, async (req) => req.user);
}
