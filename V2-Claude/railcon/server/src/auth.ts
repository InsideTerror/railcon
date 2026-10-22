import bcrypt from "bcryptjs";
import { prisma } from "./db.js";
import { config } from "./config.js";
import type { Role } from "@prisma/client";

export const PIN_RE = /^\d{6,8}$/;
const DUMMY_HASH = bcrypt.hashSync("000000", 10);

export function hashPin(pin: string): string {
  if (!PIN_RE.test(pin)) throw new Error("PIN must be 6-8 digits");
  return bcrypt.hashSync(pin, 10);
}

export async function verifyUser(forteId: string, pin: string, roles: Role[]) {
  const user = await prisma.user.findUnique({ where: { forteId } });
  // Always run a hash comparison to keep timing similar for unknown ids.
  const hash = user?.pinHash ?? DUMMY_HASH;
  const ok = bcrypt.compareSync(pin, hash);
  if (!user || !ok || !roles.includes(user.role)) return null;
  return user;
}

/** Admin portal: unlocked by any SYSADMIN user's PIN, or by ADMIN_KEY from the environment. */
export async function verifyAdminKey(key: string) {
  if (config.adminKey && key === config.adminKey) {
    return { id: 0, forteId: "admin-key", name: "Admin key", role: "SYSADMIN" as Role };
  }
  if (!PIN_RE.test(key)) return null;
  const admins = await prisma.user.findMany({ where: { role: "SYSADMIN" } });
  for (const a of admins) {
    if (bcrypt.compareSync(key, a.pinHash)) return a;
  }
  return null;
}

/** Tiny in-memory brute-force guard: 5 failures => 5 minute lock per key. */
const failures = new Map<string, { count: number; until: number }>();

export function isLocked(key: string): boolean {
  const f = failures.get(key);
  return !!f && f.until > Date.now();
}
export function recordFailure(key: string) {
  const f = failures.get(key) ?? { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= 5) {
    f.until = Date.now() + 5 * 60_000;
    f.count = 0;
  }
  failures.set(key, f);
}
export function clearFailures(key: string) {
  failures.delete(key);
}
