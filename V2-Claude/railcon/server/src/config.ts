import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
  serviceTz: process.env.SERVICE_TZ ?? "Europe/Budapest",
  clientDist: path.resolve(here, "..", process.env.CLIENT_DIST ?? "../client/dist"),
  dashHost: (process.env.DASH_HOST ?? "dash.corerail.dpdns.org").toLowerCase(),
  railconHost: (process.env.RAILCON_HOST ?? "railcon.corerail.dpdns.org").toLowerCase(),
  adminKey: process.env.ADMIN_KEY ?? "",
  isProd: process.env.NODE_ENV === "production",

  // Operational constants
  popupSeconds: 10, // dispatcher pop-ups stay on the OBU for 10 s
  connectionWindowSec: 120, // junction hold window (2 minutes)
  earlyToleranceSec: 30, // leaving more than 30 s before departure time => "EARLY!"
  sessionGraceMs: 10 * 60 * 1000, // keep a logged-in offline OBU session for 10 min
  evaluateIntervalMs: 10_000,
} as const;

if (config.isProd && config.jwtSecret === "dev-only-secret-change-me") {
  throw new Error("JWT_SECRET must be set in production");
}
