import { unzipSync, strFromU8 } from "fflate";
import { parse } from "csv-parse/sync";
import { prisma } from "../db.js";
import { parseHms } from "../time.js";
import { ImportSummary, chunk, emptySummary } from "./common.js";

type Row = Record<string, string>;

function readCsv(files: Record<string, Uint8Array>, name: string, required = true): Row[] {
  const entry = Object.keys(files).find((k) => k.toLowerCase().endsWith("/" + name) || k.toLowerCase() === name);
  if (!entry) {
    if (required) throw new Error(`GTFS archive is missing ${name}`);
    return [];
  }
  const text = strFromU8(files[entry]).replace(/^﻿/, "");
  return parse(text, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true }) as Row[];
}

export interface GtfsOptions {
  /** Only import trips of this GTFS service_id (feeds usually contain many days). */
  serviceId?: string;
  /** Safety cap on imported trips. */
  maxTrips?: number;
  /** Delete existing timetables of the imported routes first (default true). */
  replace?: boolean;
}

/**
 * GTFS zip ingestion: routes.txt, stops.txt, trips.txt, stop_times.txt.
 * Stops of each trip are ordered into integer stop_sequence_index values 1..N.
 */
export async function importGtfs(zip: Uint8Array, opts: GtfsOptions = {}): Promise<ImportSummary> {
  const summary = emptySummary("GTFS");
  const files = unzipSync(zip);
  const routesTxt = readCsv(files, "routes.txt");
  const stopsTxt = readCsv(files, "stops.txt");
  const tripsTxt = readCsv(files, "trips.txt");
  const stopTimesTxt = readCsv(files, "stop_times.txt");
  const maxTrips = opts.maxTrips ?? 5000;

  // ---- routes
  const routeIdMap = new Map<string, string>(); // gtfs route_id -> our route id
  for (const r of routesTxt) {
    const id = (r.route_short_name || r.route_id).trim();
    if (!id) continue;
    routeIdMap.set(r.route_id, id);
    const name = r.route_long_name || r.route_short_name || r.route_id;
    await prisma.route.upsert({
      where: { id },
      create: { id, name, description: r.route_desc ?? "" },
      update: { name, description: r.route_desc ?? "" },
    });
    summary.routes += 1;
  }

  // ---- stations
  const stationIdMap = new Map<string, number>(); // gtfs stop_id -> station.id
  const usedCodes = new Set<string>();
  for (const s of stopsTxt) {
    if (!s.stop_id) continue;
    if (s.location_type && s.location_type !== "0") continue; // skip parent stations / entrances
    let code = (s.stop_code || s.stop_id).trim().slice(0, 16);
    if (usedCodes.has(code)) code = `${code}-${s.stop_id}`.slice(0, 24);
    usedCodes.add(code);
    const lat = s.stop_lat ? Number(s.stop_lat) : null;
    const lon = s.stop_lon ? Number(s.stop_lon) : null;
    const row = await prisma.station.upsert({
      where: { code },
      create: { code, name: s.stop_name || code, lat: Number.isFinite(lat) ? lat : null, lon: Number.isFinite(lon) ? lon : null },
      update: { name: s.stop_name || code, lat: Number.isFinite(lat) ? lat : null, lon: Number.isFinite(lon) ? lon : null },
    });
    stationIdMap.set(s.stop_id, row.id);
    summary.stations += 1;
  }

  // ---- group stop_times per trip
  const timesByTrip = new Map<string, Row[]>();
  for (const st of stopTimesTxt) {
    const list = timesByTrip.get(st.trip_id);
    if (list) list.push(st);
    else timesByTrip.set(st.trip_id, [st]);
  }

  // ---- trips -> timetables
  const trips = tripsTxt.filter((t) => routeIdMap.has(t.route_id) && (!opts.serviceId || t.service_id === opts.serviceId));
  if (trips.length > maxTrips) summary.warnings.push(`Feed has ${trips.length} trips; only the first ${maxTrips} were imported (use a serviceId filter).`);

  if (opts.replace !== false) {
    const affected = [...new Set(trips.slice(0, maxTrips).map((t) => routeIdMap.get(t.route_id)!))];
    await prisma.timetable.deleteMany({ where: { routeId: { in: affected } } });
  }

  const usedRunNumbers = new Set<string>();
  interface Prepared {
    routeId: string;
    runNumber: string;
    direction: number;
    start: number;
    end: number;
    stops: { stationId: number; seq: number; arr: number; dep: number }[];
  }
  const prepared: Prepared[] = [];
  const canonical = new Map<string, number[]>(); // routeId -> longest outbound station list

  for (const trip of trips.slice(0, maxTrips)) {
    const rows = (timesByTrip.get(trip.trip_id) ?? []).slice().sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    if (rows.length < 2) {
      summary.warnings.push(`Trip ${trip.trip_id} skipped: fewer than 2 stop_times`);
      continue;
    }
    const routeId = routeIdMap.get(trip.route_id)!;
    let runNumber = (trip.trip_short_name || trip.trip_id).trim().slice(0, 24);
    for (let n = 2; usedRunNumbers.has(`${routeId}|${runNumber}`); n++) runNumber = `${(trip.trip_short_name || trip.trip_id).trim().slice(0, 20)}-${n}`;
    usedRunNumbers.add(`${routeId}|${runNumber}`);

    const stops: Prepared["stops"] = [];
    let prev = 0;
    let bad = false;
    rows.forEach((r, i) => {
      const stationId = stationIdMap.get(r.stop_id);
      if (!stationId) {
        bad = true;
        return;
      }
      let arr: number;
      let dep: number;
      try {
        arr = r.arrival_time ? parseHms(r.arrival_time) : NaN;
        dep = r.departure_time ? parseHms(r.departure_time) : NaN;
      } catch {
        arr = NaN;
        dep = NaN;
      }
      if (Number.isNaN(arr)) arr = Number.isNaN(dep) ? prev : dep;
      if (Number.isNaN(dep)) dep = arr;
      prev = dep;
      stops.push({ stationId, seq: i + 1, arr, dep });
    });
    if (bad) {
      summary.warnings.push(`Trip ${trip.trip_id} skipped: unknown stop_id`);
      continue;
    }
    const direction = trip.direction_id === "1" ? 2 : 1;
    prepared.push({ routeId, runNumber, direction, start: stops[0].dep, end: stops[stops.length - 1].arr, stops });
    if (direction === 1) {
      const cur = canonical.get(routeId);
      if (!cur || cur.length < stops.length) canonical.set(routeId, stops.map((s) => s.stationId));
    }
  }

  // ---- write timetables (chunked)
  for (const part of chunk(prepared, 200)) {
    const created = await prisma.timetable.createManyAndReturn({
      data: part.map((p) => ({ routeId: p.routeId, runNumber: p.runNumber, startTime: p.start, endTime: p.end, direction: p.direction })),
      select: { id: true, routeId: true, runNumber: true },
    });
    const idByKey = new Map(created.map((c) => [`${c.routeId}|${c.runNumber}`, c.id]));
    const stopRows = part.flatMap((p) =>
      p.stops.map((s) => ({
        timetableId: idByKey.get(`${p.routeId}|${p.runNumber}`)!,
        stationId: s.stationId,
        stopSequenceIndex: s.seq,
        scheduledArrival: s.arr,
        scheduledDeparture: s.dep,
      }))
    );
    for (const sub of chunk(stopRows, 5000)) await prisma.timetableStop.createMany({ data: sub });
    summary.timetables += created.length;
    summary.stopTimes += stopRows.length;
  }

  // ---- canonical route_stops (longest outbound trip)
  for (const [routeId, stationIds] of canonical) {
    await prisma.routeStop.deleteMany({ where: { routeId } });
    const seen = new Set<number>();
    const unique = stationIds.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
    await prisma.routeStop.createMany({ data: unique.map((stationId, i) => ({ routeId, stationId, stopSequenceIndex: i + 1 })) });
  }
  return summary;
}
