import { parse } from "csv-parse/sync";
import { prisma } from "../db.js";
import { parseHms } from "../time.js";
import { ImportSummary, emptySummary, stationByName } from "./common.js";

/**
 * Custom CSV import. Columns (header row optional):
 *   RouteID, RunNumber, StationName, ScheduledArrival, ScheduledDeparture, SequenceIndex
 * Times are HH:MM[:SS] (hours >= 24 allowed). Existing runs with the same RouteID + RunNumber are replaced.
 */
export async function importCsv(text: string): Promise<ImportSummary> {
  const summary = emptySummary("CSV");
  const rows = parse(text.replace(/^﻿/, ""), { skip_empty_lines: true, trim: true, relax_column_count: true }) as string[][];
  if (rows.length === 0) throw new Error("CSV is empty");

  // Skip header if the 4th column is not a time.
  if (rows[0].length >= 4 && !/^\d{1,3}:\d{2}/.test(rows[0][3] ?? "")) rows.shift();

  const groups = new Map<string, { routeId: string; runNumber: string; stops: { name: string; arr: number; dep: number; seq: number }[] }>();
  rows.forEach((r, i) => {
    if (r.length < 6) {
      summary.warnings.push(`Line ${i + 1}: expected 6 columns, got ${r.length} - skipped`);
      return;
    }
    const [routeId, runNumber, name, arrTxt, depTxt, seqTxt] = r;
    try {
      const arr = parseHms(arrTxt);
      const dep = parseHms(depTxt || arrTxt);
      const seq = Number(seqTxt);
      if (!Number.isInteger(seq)) throw new Error(`bad SequenceIndex "${seqTxt}"`);
      const key = `${routeId}|${runNumber}`;
      const g = groups.get(key) ?? { routeId, runNumber, stops: [] };
      g.stops.push({ name, arr, dep, seq });
      groups.set(key, g);
    } catch (e) {
      summary.warnings.push(`Line ${i + 1}: ${(e as Error).message} - skipped`);
    }
  });

  const stationCache = new Map<string, number>();
  const seenRoutes = new Set<string>();

  for (const g of groups.values()) {
    if (g.stops.length < 2) {
      summary.warnings.push(`Run ${g.routeId}/${g.runNumber}: fewer than 2 stops - skipped`);
      continue;
    }
    g.stops.sort((a, b) => a.seq - b.seq);

    if (!seenRoutes.has(g.routeId)) {
      seenRoutes.add(g.routeId);
      const existing = await prisma.route.findUnique({ where: { id: g.routeId } });
      if (!existing) {
        await prisma.route.create({ data: { id: g.routeId, name: g.routeId, description: "Imported from CSV" } });
        summary.routes += 1;
      }
    }

    const stationIds: number[] = [];
    for (const s of g.stops) stationIds.push(await stationByName(s.name, stationCache, summary));

    // Canonical order + direction
    let canonical = await prisma.routeStop.findMany({ where: { routeId: g.routeId }, orderBy: { stopSequenceIndex: "asc" } });
    if (canonical.length === 0) {
      const unique = [...new Set(stationIds)];
      await prisma.routeStop.createMany({ data: unique.map((stationId, i) => ({ routeId: g.routeId, stationId, stopSequenceIndex: i + 1 })) });
      canonical = await prisma.routeStop.findMany({ where: { routeId: g.routeId }, orderBy: { stopSequenceIndex: "asc" } });
    }
    const direction = canonical.length > 0 && stationIds[0] === canonical[canonical.length - 1].stationId && stationIds[0] !== canonical[0].stationId ? 2 : 1;

    await prisma.timetable.deleteMany({ where: { routeId: g.routeId, runNumber: g.runNumber } });
    await prisma.timetable.create({
      data: {
        routeId: g.routeId,
        runNumber: g.runNumber,
        direction,
        startTime: g.stops[0].dep,
        endTime: g.stops[g.stops.length - 1].arr,
        stops: {
          create: g.stops.map((s, i) => ({
            stationId: stationIds[i],
            stopSequenceIndex: i + 1, // normalised 1..N regardless of the file's numbering
            scheduledArrival: s.arr,
            scheduledDeparture: s.dep,
          })),
        },
      },
    });
    summary.timetables += 1;
    summary.stopTimes += g.stops.length;
  }
  return summary;
}
