import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.cannedOption.deleteMany();
  await prisma.message.deleteMany();
  await prisma.activeSession.deleteMany();
  await prisma.timetableStop.deleteMany();
  await prisma.timetable.deleteMany();
  await prisma.routeStop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();

  const pinHash = await bcrypt.hash('123456', 10);

  const driver1 = await prisma.user.create({
    data: {
      pinHash,
      forteId: 'DRV001',
      name: 'John Smith',
      role: 'DRIVER',
    },
  });

  const driver2 = await prisma.user.create({
    data: {
      pinHash,
      forteId: 'DRV002',
      name: 'Sarah Johnson',
      role: 'DRIVER',
    },
  });

  const dispatcher = await prisma.user.create({
    data: {
      pinHash,
      forteId: 'DSP001',
      name: 'Michael Brown',
      role: 'DISPATCHER',
    },
  });

  const sysadmin = await prisma.user.create({
    data: {
      pinHash,
      forteId: 'SYS001',
      name: 'Admin User',
      role: 'SYSADMIN',
    },
  });

  console.log('✅ Users created');

  const stations = await Promise.all([
    'Budapest Nyugati', 'Budapest Déli', 'Kelenföld', 'Bicske', 'Tatabánya', 'Oroszlány', 'Esztergom',
    'Székesfehérvár', 'Siófok', 'Balatonföldvár', 'Balatonszemes', 'Fonyód', 'Balatonboglár', 'Keszthely',
    'Győr', 'Veszprém', 'Zalaegerszeg', 'Nagykanizsa', 'Pécs', 'Szekszárd', 'Baja', 'Kecskemét', 'Szeged',
    'Debrecen', 'Nyíregyháza', 'Miskolc', 'Eger', 'Salgótarján', 'Szolnok', 'Békéscsaba', 'Hódmezővásárhely'
  ].map(name => prisma.station.create({
    data: { name, code: name.replace(/\s+/g, '_').toUpperCase() },
  })));

  const stationMap = new Map(stations.map(s => [s.name, s.id]));
  console.log('✅ Stations created');

  const routeS70 = await prisma.route.create({
    data: {
      id: 'S70',
      name: 'Budapest-Esztergom',
      description: 'Main line connecting Budapest to Esztergom via Tatabánya',
      stops: {
        create: [
          { stationId: stationMap.get('Budapest Nyugati')!, stopSequenceIndex: 1 },
          { stationId: stationMap.get('Budapest Déli')!, stopSequenceIndex: 2 },
          { stationId: stationMap.get('Kelenföld')!, stopSequenceIndex: 3 },
          { stationId: stationMap.get('Bicske')!, stopSequenceIndex: 4 },
          { stationId: stationMap.get('Tatabánya')!, stopSequenceIndex: 5 },
          { stationId: stationMap.get('Oroszlány')!, stopSequenceIndex: 6 },
          { stationId: stationMap.get('Esztergom')!, stopSequenceIndex: 7 },
        ],
      },
    },
    include: { stops: { include: { station: true } } },
  });

  const routeS10 = await prisma.route.create({
    data: {
      id: 'S10',
      name: 'Budapest-Székesfehérvár',
      description: 'Regional line to Székesfehérvár',
      stops: {
        create: [
          { stationId: stationMap.get('Budapest Déli')!, stopSequenceIndex: 1 },
          { stationId: stationMap.get('Kelenföld')!, stopSequenceIndex: 2 },
          { stationId: stationMap.get('Bicske')!, stopSequenceIndex: 3 },
          { stationId: stationMap.get('Székesfehérvár')!, stopSequenceIndex: 4 },
        ],
      },
    },
    include: { stops: { include: { station: true } } },
  });

  const routeS30 = await prisma.route.create({
    data: {
      id: 'S30',
      name: 'Budapest-Balaton',
      description: 'Express service to Lake Balaton',
      stops: {
        create: [
          { stationId: stationMap.get('Budapest Déli')!, stopSequenceIndex: 1 },
          { stationId: stationMap.get('Kelenföld')!, stopSequenceIndex: 2 },
          { stationId: stationMap.get('Székesfehérvár')!, stopSequenceIndex: 3 },
          { stationId: stationMap.get('Siófok')!, stopSequenceIndex: 4 },
          { stationId: stationMap.get('Balatonföldvár')!, stopSequenceIndex: 5 },
          { stationId: stationMap.get('Balatonszemes')!, stopSequenceIndex: 6 },
          { stationId: stationMap.get('Fonyód')!, stopSequenceIndex: 7 },
          { stationId: stationMap.get('Balatonboglár')!, stopSequenceIndex: 8 },
          { stationId: stationMap.get('Keszthely')!, stopSequenceIndex: 9 },
        ],
      },
    },
    include: { stops: { include: { station: true } } },
  });

  console.log('✅ Routes created');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const createTimetable = async (routeId: string, runNumber: string, startHour: number, startMin: number, direction: number, stops: Array<{ station: string; arr: string; dep: string; seq: number }>) => {
    const startTime = new Date(today);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(today);
    const lastStop = stops[stops.length - 1];
    const [endHour, endMin] = lastStop.dep.split(':').map(Number);
    endTime.setHours(endHour, endMin, 0, 0);

    return prisma.timetable.create({
      data: {
        routeId,
        runNumber,
        startTime,
        endTime,
        direction,
        stops: {
          create: stops.map(s => ({
            stationId: stationMap.get(s.station)!,
            stopSequenceIndex: s.seq,
            scheduledArrival: new Date(new Date(today).setHours(...s.arr.split(':').map(Number), 0, 0)),
            scheduledDeparture: new Date(new Date(today).setHours(...s.dep.split(':').map(Number), 0, 0)),
          })),
        },
      },
      include: { stops: { include: { station: true } } },
    });
  };

  await createTimetable('S70', '0001', 6, 0, 1, [
    { station: 'Budapest Nyugati', arr: '06:00', dep: '06:00', seq: 1 },
    { station: 'Budapest Déli', arr: '06:15', dep: '06:17', seq: 2 },
    { station: 'Kelenföld', arr: '06:25', dep: '06:26', seq: 3 },
    { station: 'Bicske', arr: '06:45', dep: '06:46', seq: 4 },
    { station: 'Tatabánya', arr: '07:05', dep: '07:07', seq: 5 },
    { station: 'Oroszlány', arr: '07:20', dep: '07:21', seq: 6 },
    { station: 'Esztergom', arr: '07:40', dep: '07:40', seq: 7 },
  ]);

  await createTimetable('S70', '0002', 7, 30, 1, [
    { station: 'Budapest Nyugati', arr: '07:30', dep: '07:30', seq: 1 },
    { station: 'Budapest Déli', arr: '07:45', dep: '07:47', seq: 2 },
    { station: 'Kelenföld', arr: '07:55', dep: '07:56', seq: 3 },
    { station: 'Bicske', arr: '08:15', dep: '08:16', seq: 4 },
    { station: 'Tatabánya', arr: '08:35', dep: '08:37', seq: 5 },
    { station: 'Oroszlány', arr: '08:50', dep: '08:51', seq: 6 },
    { station: 'Esztergom', arr: '09:10', dep: '09:10', seq: 7 },
  ]);

  await createTimetable('S70', '0003', 6, 30, 2, [
    { station: 'Esztergom', arr: '06:30', dep: '06:30', seq: 1 },
    { station: 'Oroszlány', arr: '06:48', dep: '06:49', seq: 2 },
    { station: 'Tatabánya', arr: '07:02', dep: '07:04', seq: 3 },
    { station: 'Bicske', arr: '07:22', dep: '07:23', seq: 4 },
    { station: 'Kelenföld', arr: '07:42', dep: '07:43', seq: 5 },
    { station: 'Budapest Déli', arr: '07:52', dep: '07:54', seq: 6 },
    { station: 'Budapest Nyugati', arr: '08:10', dep: '08:10', seq: 7 },
  ]);

  await createTimetable('S10', '0101', 8, 0, 1, [
    { station: 'Budapest Déli', arr: '08:00', dep: '08:00', seq: 1 },
    { station: 'Kelenföld', arr: '08:10', dep: '08:11', seq: 2 },
    { station: 'Bicske', arr: '08:30', dep: '08:31', seq: 3 },
    { station: 'Székesfehérvár', arr: '08:55', dep: '08:55', seq: 4 },
  ]);

  await createTimetable('S30', '0301', 9, 0, 1, [
    { station: 'Budapest Déli', arr: '09:00', dep: '09:00', seq: 1 },
    { station: 'Kelenföld', arr: '09:10', dep: '09:11', seq: 2 },
    { station: 'Székesfehérvár', arr: '09:35', dep: '09:37', seq: 3 },
    { station: 'Siófok', arr: '10:10', dep: '10:12', seq: 4 },
    { station: 'Balatonföldvár', arr: '10:25', dep: '10:26', seq: 5 },
    { station: 'Balatonszemes', arr: '10:35', dep: '10:36', seq: 6 },
    { station: 'Fonyód', arr: '10:48', dep: '10:49', seq: 7 },
    { station: 'Balatonboglár', arr: '11:00', dep: '11:01', seq: 8 },
    { station: 'Keszthely', arr: '11:20', dep: '11:20', seq: 9 },
  ]);

  console.log('✅ Timetables created');

  const cannedMessages = [
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Vehicle Malfunction', templateText: 'Technical fault on locomotive/car. Requesting assistance.', displayOrder: 1 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Missing Relief', templateText: 'Replacement driver has not arrived at shift change point.', displayOrder: 2 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Call Back Request', templateText: 'Request voice/text callback from dispatcher.', displayOrder: 3 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Passenger Delay', templateText: 'Unscheduled delay due to boarding issues or passenger assistance.', displayOrder: 4 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Signal Failure', templateText: 'Stopped at red signal / interlocking block error.', displayOrder: 5 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Track Obstruction', templateText: 'Debris or vehicle blocking track/crossing.', displayOrder: 6 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Medical Emergency', templateText: 'Medical incident aboard train requiring assistance.', displayOrder: 7 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Door Malfunction', templateText: 'Passenger door failed to close/lock.', displayOrder: 8 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Speed Restriction', templateText: 'Temporary speed restriction active on line segment.', displayOrder: 9 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Overcrowding', templateText: 'Extreme passenger density causing boarding delays.', displayOrder: 10 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Weather Delay', templateText: 'Delay due to adverse weather conditions on line.', displayOrder: 11 },
    { category: 'DRIVER_TO_DISPATCH' as const, label: 'Police Activity', templateText: 'Police operation affecting line operations.', displayOrder: 12 },
  ];

  const cannedAnnouncements = [
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Doors Closing', templateText: 'Caution, doors are closing.', displayOrder: 1 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Wheelchair Assistance', templateText: 'Boarding assistance in progress, please hold.', displayOrder: 2 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'AC Operational', templateText: 'Air conditioning is active, please keep windows closed.', displayOrder: 3 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Unable to Dock', templateText: 'Vehicle cannot pull up to platform edge.', displayOrder: 4 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Minor Delay', templateText: 'Train is delayed due to traffic congestion. Thank you for your patience.', displayOrder: 5 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Terminal Stop', templateText: 'This is the final stop. All passengers must alight.', displayOrder: 6 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Ticket Inspection', templateText: 'Ticket inspection in progress. Please present valid passes.', displayOrder: 7 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Stand Clear', templateText: 'Please move towards the inside of the carriage.', displayOrder: 8 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Connection Hold', templateText: 'Holding briefly for connecting service.', displayOrder: 9 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Emergency Stop Notice', templateText: 'Train halted due to technical verification.', displayOrder: 10 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Next Station', templateText: 'Next station: {station}. Please prepare to alight.', displayOrder: 11 },
    { category: 'PASSENGER_ANNOUNCEMENT' as const, label: 'Service Disruption', templateText: 'Service disruption ahead. Expect delays.', displayOrder: 12 },
  ];

  await prisma.cannedOption.createMany({ data: [...cannedMessages, ...cannedAnnouncements] });
  console.log('✅ Canned options seeded');

  await prisma.activeSession.create({
    data: {
      clientId: 'OBU-001',
      driverId: driver1.id,
      timetableId: (await prisma.timetable.findFirst({ where: { routeId: 'S70', runNumber: '0001' } }))!.id,
      currentStopIndex: 0,
      delayMinutes: 0,
      status: 'ACTIVE',
    },
  });

  await prisma.activeSession.create({
    data: {
      clientId: 'OBU-002',
      driverId: driver2.id,
      timetableId: (await prisma.timetable.findFirst({ where: { routeId: 'S10', runNumber: '0101' } }))!.id,
      currentStopIndex: 2,
      delayMinutes: 3,
      status: 'ACTIVE',
    },
  });

  await prisma.activeSession.create({
    data: {
      clientId: 'OBU-003',
      status: 'IDLE',
    },
  });

  await prisma.activeSession.create({
    data: {
      clientId: 'OBU-004',
      status: 'NON_ACTIVE',
    },
  });

  console.log('✅ Active sessions created');
  console.log('🎉 Seeding completed!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
