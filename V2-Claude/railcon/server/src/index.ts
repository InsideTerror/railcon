import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { ensureSeed } from "./seedCore.js";
import { authRoutes, type JwtUser } from "./routes/auth.js";
import { dispatchRoutes } from "./routes/dispatch.js";
import { adminRoutes } from "./routes/admin.js";
import { attachWebSockets } from "./ws.js";
import { hydrateFromDb, setAfterChange, sweepOfflineSessions, clients } from "./state.js";
import { scheduleEvaluate, startConnectionLoop } from "./connections.js";
import { CmdError } from "./engine.js";

async function main() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" }, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });

  await app.register(cors, { origin: true, credentials: false });
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(multipart, { limits: { fileSize: 200 * 1024 * 1024, files: 1 } });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") });
    }
    if (err instanceof CmdError) return reply.code(err.status).send({ error: err.message });
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return reply.code(409).send({ error: "A record with the same unique value already exists" });
      if (err.code === "P2025") return reply.code(404).send({ error: "Record not found" });
      if (err.code === "P2003") return reply.code(409).send({ error: "Record is referenced by other data or references something that does not exist" });
    }
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(err);
    return reply.code(status).send({ error: status >= 500 ? "Internal server error" : err.message });
  });

  app.get("/health", async () => ({
    ok: true,
    clients: clients.size,
    hosts: { telemetry: config.railconHost, dashboard: config.dashHost },
  }));

  await app.register(authRoutes);
  await app.register(dispatchRoutes);
  await app.register(adminRoutes);

  // Built client (OBU + dashboard + admin portal) - same bundle on both hostnames.
  if (fs.existsSync(path.join(config.clientDist, "index.html"))) {
    await app.register(fastifyStatic, { root: config.clientDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api") || req.url.startsWith("/ws")) return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html");
    });
  } else {
    app.log.warn(`Client bundle not found at ${config.clientDist} - run "npm run build -w client" to serve the UI from this process.`);
  }

  await prisma.$connect();
  await ensureSeed((m) => app.log.info(m));
  const restored = await hydrateFromDb();
  if (restored) app.log.info(`Restored ${restored} live session(s) from the database`);

  setAfterChange(scheduleEvaluate);
  startConnectionLoop();
  setInterval(sweepOfflineSessions, 30_000);

  await app.ready();
  attachWebSockets(app.server, async (token) => {
    try {
      return app.jwt.verify<JwtUser>(token);
    } catch {
      return null;
    }
  });

  await app.listen({ port: config.port, host: config.host });
  app.log.info(`C.O.R.E. server up. Telemetry: wss://${config.railconHost}/ws/obu  Dashboard: https://${config.dashHost}`);

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
