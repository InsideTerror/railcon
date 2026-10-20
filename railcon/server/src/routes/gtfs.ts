import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

export async function gtfsRoutes(app: FastifyInstance) {
  app.post('/gtfs/import', async (request, reply) => {
    const schema = z.object({
      gtfsPath: z.string().min(1),
    });

    const { gtfsPath } = schema.parse(request.body);

    if (!fs.existsSync(gtfsPath)) {
      return reply.code(400).send({ error: 'GTFS directory not found' });
    }

    const routesFile = path.join(gtfsPath, 'routes.txt');
    const stopsFile = path.join(gtfsPath, 'stops.txt');
    const tripsFile = path.join(gtfsPath, 'trips.txt');
    const stopTimesFile = path.join(gtfsPath, 'stop_times.txt');

    if (!fs.existsSync(routesFile) || !fs.existsSync(stopsFile) || !fs.existsSync(tripsFile) || !fs.existsSync(stopTimesFile)) {
      return reply.code(400).send({ error: 'Required GTFS files missing' });
    }

    const routesContent = fs.readFileSync(routesFile, 'utf-8');
    const stopsContent = fs.readFileSync(stopsFile, 'utf-8');
    const tripsContent = fs.readFileSync(tripsFile, 'utf-8');
    const stopTimesContent = fs.readFileSync(stopTimesFile, 'utf-8');

    const routes = parse(routesContent, { columns: true, skip_empty_lines: true });
    const stops = parse(stopsContent, { columns: true, skip_empty_lines: true });
    const trips = parse(tripsContent, { columns: true, skip_empty_lines: true });
    const stopTimes = parse(stopTimesContent, { columns: true, skip_empty_lines: true });

    const stationMap = new Map<string, string>();

    for (const stop of stops) {
      const station = await prisma.station.upsert({
        where: { code: stop.stop_id },
        update: { name: stop.stop_name },
        create: { code: stop.stop_id, name: stop.stop_name },
      });
      stationMap.set(stop.stop_id, station.id);
    }

    for (const route of routes) {
      const dbRoute = await prisma.route.upsert({
        where: { id: route.route_id },
        update: { name: route.route_long_name || route.route_short_name, description: route.route_desc },
        create: { id: route.route_id, name: route.route_long_name || route.route_short_name, description: route.route_desc },
      });

      const routeTrips = trips.filter((t: any) => t.route_id === route.route_id);

      for (const trip of routeTrips) {
        const tripStopTimes = stopTimes
          .filter((st: any) => st.trip_id === trip.trip_id)
          .sort((a: any, b: any) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));

        const timetable = await prisma.timetable.create({
          data: {
            routeId: dbRoute.id,
            runNumber: trip.trip_id,
            startTime: new Date(`1970-01-01T${tripStopTimes[0]?.departure_time || '00:00:00'}Z`),
            endTime: new Date(`1970-01-01T${tripStopTimes[tripStopTimes.length - 1]?.arrival_time || '23:59:59'}Z`),
            direction: trip.direction_id ? parseInt(trip.direction_id) : 1,
            stops: {
              create: tripStopTimes.map((st: any, idx: number) => ({
                stationId: stationMap.get(st.stop_id)!,
                stopSequenceIndex: parseInt(st.stop_sequence),
                scheduledArrival: st.arrival_time ? new Date(`1970-01-01T${st.arrival_time}Z`) : null,
                scheduledDeparture: st.departure_time ? new Date(`1970-01-01T${st.departure_time}Z`) : null,
              })),
            },
          },
        });
      }
    }

    return { success: true, message: 'GTFS import completed' };
  });

  app.post('/csv/import', async (request, reply) => {
    const schema = z.object({
      csvPath: z.string().min(1),
    });

    const { csvPath } = schema.parse(request.body);

    if (!fs.existsSync(csvPath)) {
      return reply.code(400).send({ error: 'CSV file not found' });
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });

    for (const record of records) {
      const { RouteID, RunNumber, StationName, ScheduledArrival, ScheduledDeparture, SequenceIndex } = record;

      let station = await prisma.station.findFirst({ where: { name: StationName } });
      if (!station) {
        station = await prisma.station.create({ data: { name: StationName, code: StationName.replace(/\s+/g, '_').toUpperCase() } });
      }

      let route = await prisma.route.findUnique({ where: { id: RouteID } });
      if (!route) {
        route = await prisma.route.create({ data: { id: RouteID, name: RouteID } });
      }

      await prisma.routeStop.upsert({
        where: { routeId_stationId: { routeId: RouteID, stationId: station.id } },
        update: { stopSequenceIndex: parseInt(SequenceIndex) },
        create: { routeId: RouteID, stationId: station.id, stopSequenceIndex: parseInt(SequenceIndex) },
      });

      const timetable = await prisma.timetable.create({
        data: {
          routeId: RouteID,
          runNumber: RunNumber,
          startTime: new Date(ScheduledArrival),
          endTime: new Date(ScheduledDeparture),
          direction: 1,
          stops: {
            create: {
              stationId: station.id,
              stopSequenceIndex: parseInt(SequenceIndex),
              scheduledArrival: new Date(ScheduledArrival),
              scheduledDeparture: new Date(ScheduledDeparture),
            },
          },
        },
      });
    }

    return { success: true, message: 'CSV import completed', count: records.length };
  });
}
