import { config } from "./config.js";

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: config.serviceTz,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Seconds since local (service timezone) midnight. */
export function nowSec(date: Date = new Date()): number {
  const parts = fmt.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 3600 + get("minute") * 60 + get("second");
}

/** Signed difference now - scheduled, wrapped into (-12h, +12h] so midnight crossings work. */
export function diffSec(now: number, scheduled: number): number {
  let d = now - scheduled;
  while (d > 43200) d -= 86400;
  while (d <= -43200) d += 86400;
  return d;
}

export function fmtHms(sec: number): string {
  const s = ((Math.round(sec) % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return [h, m, x].map((n) => String(n).padStart(2, "0")).join(":");
}

/** "HH:MM[:SS]" (GTFS allows hours >= 24) -> seconds. */
export function parseHms(text: string): number {
  const m = /^\s*(\d{1,3}):(\d{2})(?::(\d{2}))?\s*$/.exec(text);
  if (!m) throw new Error(`Invalid time "${text}" (expected HH:MM or HH:MM:SS)`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0);
}
