import { prisma } from "./db.js";
import { hashPin } from "./auth.js";
import { config } from "./config.js";

// ---------------------------------------------------------------------------
// Canned options (spec section 4) - always (re)applied on boot.
// ---------------------------------------------------------------------------
export const DRIVER_MESSAGES: [string, string][] = [
  ["Vehicle Malfunction", "Technical fault on locomotive/car."],
  ["Missing Relief", "Replacement driver has not arrived at shift change point."],
  ["Call Back Request", "Request voice/text callback from dispatcher."],
  ["Passenger Delay", "Unscheduled delay due to boarding issues or passenger assistance."],
  ["Signal Failure", "Stopped at red signal / interlocking block error."],
  ["Track Obstruction", "Debris or vehicle blocking track/crossing."],
  ["Medical Emergency", "Medical incident aboard train requiring assistance."],
  ["Door Malfunction", "Passenger door failed to close/lock."],
  ["Speed Restriction", "Temporary speed restriction active on line segment."],
  ["Overcrowding", "Extreme passenger density causing boarding delays."],
  ["Late Departure Request", "Request permission to depart late due to operational reasons."],
  ["Fuel / Energy Low", "Fuel or traction energy level requires attention."],
];

export const ANNOUNCEMENTS: [string, string][] = [
  ["Doors Closing", "Caution, doors are closing."],
  ["Wheelchair Assistance", "Boarding assistance in progress, please hold."],
  ["AC Operational", "Air conditioning is active, please keep windows closed."],
  ["Unable to Dock", "Vehicle cannot pull up to platform edge."],
  ["Minor Delay", "Train is delayed due to traffic congestion. Thank you for your patience."],
  ["Terminal Stop", "This is the final stop. All passengers must alight."],
  ["Ticket Inspection", "Ticket inspection in progress. Please present valid passes."],
  ["Stand Clear", "Please move towards the inside of the carriage."],
  ["Connection Hold", "Holding briefly for connecting service."],
  ["Emergency Stop Notice", "Train halted due to technical verification."],
  ["Mind The Gap", "Please mind the gap between the train and the platform."],
  ["Keep Belongings", "Please keep your belongings with you at all times."],
];

export async function ensureCannedOptions() {
  const rows = [
    ...DRIVER_MESSAGES.map(([label, templateText], i) => ({
      category: "DRIVER_TO_DISPATCH" as const,
      label,
      templateText,
      displayOrder: i + 1,
    })),
    ...ANNOUNCEMENTS.map(([label, templateText], i) => ({
      category: "PASSENGER_ANNOUNCEMENT" as const,
      label,
      templateText,
      displayOrder: i + 1,
    })),
  ];
  for (const r of rows) {
    await prisma.cannedOption.upsert({
      where: { category_label: { category: r.category, label: r.label } },
      create: r,
      update: {}, // never overwrite edits made in the admin portal
    });
  }
}

// ---------------------------------------------------------------------------
// Demo network
// ---------------------------------------------------------------------------
interface SeedStation {
  code: string;
  name: string;
  lat: number;
  lon: number;
}
const STATIONS: SeedStation[] = [
  { code: "NYU", name: "Budapest-Nyugati", lat: 47.5104, lon: 19.0568 },
  { code: "UJP", name: "Újpest", lat: 47.5612, lon: 19.0905 },
  { code: "PVV", name: "Pilisvörösvár", lat: 47.6150, lon: 18.907 },
  { code: "PCS", name: "Piliscsaba", lat: 47.635, lon: 18.824 },
  { code: "DOR", name: "Dorog", lat: 47.719, lon: 18.733 },
  { code: "ESZ", name: "Esztergom", lat: 47.787, lon: 18.739 },
  { code: "VAC", name: "Vác", lat: 47.777, lon: 19.128 },
  { code: "GOD", name: "Göd", lat: 47.691, lon: 19.138 },
  { code: "KEL", name: "Budapest-Kelenföld", lat: 47.464, lon: 19.02 },
];

interface SeedRoute {
  id: string;
  name: string;
  description: string;
  stops: string[]; // station codes, outbound order
  /** minutes after trip start at which each stop is reached (outbound) */
  offsets: number[];
  /** first start time of outbound/inbound runs, minutes after midnight */
  firstOut: number;
  firstIn: number;
  headway: number;
  last: number; // last start, minutes after midnight
}

const ROUTES: SeedRoute[] = [
  {
    id: "S70",
    name: "Budapest-Esztergom",
    description: "Suburban line from Budapest-Nyugati via Újpest and Pilisvörösvár to Esztergom.",
    stops: ["NYU", "UJP", "PVV", "PCS", "DOR", "ESZ"],
    offsets: [0, 12, 33, 42, 55, 65],
    firstOut: 5 * 60, // :00 / :30 -> arrives Újpest at :12/:42, leaves :13/:43
    firstIn: 5 * 60 + 15,
    headway: 30,
    last: 22 * 60 + 30,
  },
  {
    id: "S71",
    name: "Vác-Budapest-Kelenföld",
    description: "Suburban line from Vác via Göd and Újpest to Budapest-Kelenföld. Connects with S70 at Újpest.",
    stops: ["VAC", "GOD", "UJP", "KEL"],
    offsets: [0, 9, 20, 38],
    firstOut: 4 * 60 + 54 + 30, // arrives Újpest at :14/:44, leaves :15/:45
    firstIn: 5 * 60 + 10,
    headway: 30,
    last: 22 * 60 + 30,
  },
];

const DWELL_SEC = 60;

export async function seedDemoNetwork() {
  // Stations
  for (const s of STATIONS) {
    await prisma.station.upsert({
      where: { code: s.code },
      create: s,
      update: { name: s.name, lat: s.lat, lon: s.lon },
    });
  }
  const stationByCode = new Map((await prisma.station.findMany()).map((s) => [s.code, s]));

  for (const r of ROUTES) {
    await prisma.route.upsert({
      where: { id: r.id },
      create: { id: r.id, name: r.name, description: r.description },
      update: {},
    });

    // Canonical outbound order
    const existingStops = await prisma.routeStop.count({ where: { routeId: r.id } });
    if (existingStops === 0) {
      await prisma.routeStop.createMany({
        data: r.stops.map((code, i) => ({
          routeId: r.id,
          stationId: stationByCode.get(code)!.id,
          stopSequenceIndex: i + 1,
        })),
      });
    }

    const existingRuns = await prisma.timetable.count({ where: { routeId: r.id } });
    if (existingRuns > 0) continue;

    let runNo = 1;
    const dirs: { direction: 1 | 2; first: number }[] = [
      { direction: 1, first: r.firstOut },
      { direction: 2, first: r.firstIn },
    ];
    // Interleave runs so numbers are in chronological order per route.
    const all: { direction: 1 | 2; start: number }[] = [];
    for (const d of dirs) {
      for (let t = d.first; t <= r.last; t += r.headway) all.push({ direction: d.direction, start: t });
    }
    all.sort((a, b) => a.start - b.start);

    const total = r.offsets[r.offsets.length - 1];
    for (const trip of all) {
      const codes = trip.direction === 1 ? r.stops : [...r.stops].reverse();
      const offs =
        trip.direction === 1 ? r.offsets : r.offsets.map((o) => total - o).reverse();
      const startSec = trip.start * 60;
      const endSec = startSec + total * 60;
      const runNumber = String(runNo++).padStart(4, "0");
      await prisma.timetable.create({
        data: {
          routeId: r.id,
          runNumber,
          startTime: startSec,
          endTime: endSec,
          direction: trip.direction,
          stops: {
            create: codes.map((code, i) => {
              const base = startSec + offs[i] * 60;
              const first = i === 0;
              const last = i === codes.length - 1;
              return {
                stationId: stationByCode.get(code)!.id,
                stopSequenceIndex: i + 1,
                scheduledArrival: first ? base : base - DWELL_SEC / 2 + 0,
                scheduledDeparture: last ? base : first ? base : base + DWELL_SEC / 2,
              };
            }),
          },
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export interface SeedCredentials {
  driver: string;
  dispatcher: string;
  sysadmin: string;
}

export async function seedUsers(): Promise<SeedCredentials | null> {
  const count = await prisma.user.count();
  if (count > 0) return null;

  const pins: SeedCredentials = {
    driver: process.env.SEED_DRIVER_PIN ?? "123456",
    dispatcher: process.env.SEED_DISPATCHER_PIN ?? "654321",
    sysadmin: process.env.SEED_SYSADMIN_PIN ?? "99999999",
  };
  if (config.isProd && !process.env.SEED_SYSADMIN_PIN) {
    throw new Error("In production set SEED_SYSADMIN_PIN / SEED_DISPATCHER_PIN / SEED_DRIVER_PIN before first start.");
  }

  await prisma.user.createMany({
    data: [
      { forteId: "856", name: "John Smith", role: "DRIVER", pinHash: hashPin(pins.driver) },
      { forteId: "857", name: "Anna Kovacs", role: "DRIVER", pinHash: hashPin(pins.driver) },
      { forteId: "9001", name: "Maria Dispatcher", role: "DISPATCHER", pinHash: hashPin(pins.dispatcher) },
      { forteId: "9999", name: "System Administrator", role: "SYSADMIN", pinHash: hashPin(pins.sysadmin) },
    ],
  });
  return pins;
}

/** Called on every server boot: canned options always, demo data only on an empty database. */
export async function ensureSeed(log: (msg: string) => void = console.log) {
  await ensureCannedOptions();
  const creds = await seedUsers();
  if (creds) {
    log("Seeded users: driver 856 / PIN " + creds.driver + ", dispatcher 9001 / PIN " + creds.dispatcher + ", sysadmin 9999 / PIN " + creds.sysadmin);
    await seedDemoNetwork();
    log("Seeded demo network (S70, S71).");
  }
}
