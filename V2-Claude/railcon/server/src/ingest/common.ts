import { prisma } from "../db.js";

export interface ImportSummary {
  source: "GTFS" | "CSV";
  routes: number;
  stations: number;
  timetables: number;
  stopTimes: number;
  warnings: string[];
}

export function emptySummary(source: ImportSummary["source"]): ImportSummary {
  return { source, routes: 0, stations: 0, timetables: 0, stopTimes: 0, warnings: [] };
}

export function slugCode(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
  const words = base.split(" ").filter(Boolean);
  if (words.length === 0) return "STN";
  const code = words.length === 1 ? words[0].slice(0, 6) : words.map((w) => w.slice(0, 3)).join("").slice(0, 8);
  return code || "STN";
}

/** Find a station by case-insensitive name, creating it with a unique code if needed. */
export async function stationByName(name: string, cache: Map<string, number>, summary: ImportSummary): Promise<number> {
  const key = name.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const found = await prisma.station.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" } } });
  if (found) {
    cache.set(key, found.id);
    return found.id;
  }
  let code = slugCode(name);
  let n = 1;
  while (await prisma.station.findUnique({ where: { code } })) code = `${slugCode(name).slice(0, 6)}${++n}`;
  const created = await prisma.station.create({ data: { name: name.trim(), code } });
  summary.stations += 1;
  cache.set(key, created.id);
  return created.id;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
