import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { config } from '../config';
import prisma from '../lib/prisma';
import { getConnectedClients } from '../lib/websocket';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

let pisServer: ReturnType<typeof createServer> | null = null;

export function startPISServer(port: number) {
  if (pisServer) return;

  pisServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';

    if (pathname === '/passenger-display' || pathname === '/passenger-display/') {
      await servePassengerDisplay(req, res);
      return;
    }

    if (pathname === '/api/pis/data') {
      await servePISData(req, res, parsedUrl.query.clientId as string);
      return;
    }

    serveStaticFile(req, res, pathname);
  });

  pisServer.listen(port, '0.0.0.0', () => {
    console.log(`🖥️  PIS Server running on port ${port}`);
  });
}

async function servePassengerDisplay(req: IncomingMessage, res: ServerResponse) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>C.O.R.E. Passenger Information</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #fff; overflow: hidden; }
    .container { display: grid; grid-template-columns: 1fr 2fr; height: 100vh; }
    .left-panel { background: #111; border-right: 2px solid #333; padding: 20px; display: flex; flex-direction: column; }
    .right-panel { background: #0a0a0a; padding: 20px; overflow-y: auto; }
    .line-info { text-align: center; margin-bottom: 30px; }
    .line-number { font-size: 4rem; font-weight: 700; color: #ffd700; text-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
    .destination { font-size: 1.5rem; color: #ccc; margin-top: 10px; }
    .next-stop { background: #1a1a1a; border: 2px solid #ffd700; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .next-stop-label { font-size: 0.9rem; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
    .next-stop-name { font-size: 2.5rem; font-weight: 600; color: #fff; }
    .time-info { display: flex; justify-content: space-between; margin-top: 20px; }
    .time-box { text-align: center; }
    .time-label { font-size: 0.8rem; color: #888; text-transform: uppercase; }
    .time-value { font-size: 1.5rem; font-weight: 600; color: #ffd700; }
    .stops-list { list-style: none; }
    .stop-item { display: flex; justify-content: space-between; align-items: center; padding: 15px 10px; border-bottom: 1px solid #222; transition: background 0.2s; }
    .stop-item:hover { background: #1a1a1a; }
    .stop-item.completed { opacity: 0.4; }
    .stop-item.current { background: #1a3a1a; border-left: 4px solid #00ff00; }
    .stop-item.next { background: #3a2a0a; border-left: 4px solid #ffd700; }
    .stop-sequence { font-size: 1.2rem; font-weight: 600; color: #ffd700; min-width: 40px; text-align: center; }
    .stop-name { flex: 1; font-size: 1.1rem; margin: 0 20px; }
    .stop-time { font-size: 1rem; color: #aaa; font-variant-numeric: tabular-nums; }
    .delay-badge { background: #ff4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
    .delay-badge.minor { background: #ffaa00; }
    .clock { font-size: 3rem; font-weight: 300; text-align: center; margin-top: 30px; font-variant-numeric: tabular-nums; color: #ffd700; }
    @media (max-width: 1024px) {
      .container { grid-template-columns: 1fr; }
      .line-number { font-size: 3rem; }
      .next-stop-name { font-size: 2rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="left-panel">
      <div class="line-info">
        <div class="line-number" id="lineNumber">--</div>
        <div class="destination" id="destination">--</div>
      </div>
      <div class="next-stop">
        <div class="next-stop-label">Next Stop</div>
        <div class="next-stop-name" id="nextStop">--</div>
      </div>
      <div class="time-info">
        <div class="time-box">
          <div class="time-label">Arrival</div>
          <div class="time-value" id="arrivalTime">--:--</div>
        </div>
        <div class="time-box">
          <div class="time-label">Departure</div>
          <div class="time-value" id="departureTime">--:--</div>
        </div>
      </div>
    </div>
    <div class="right-panel">
      <ul class="stops-list" id="stopsList"></ul>
      <div class="clock" id="clock">--:--:--</div>
    </div>
  </div>
  <script>
    let currentClientId = null;
    let currentTimetable = null;
    let currentStopIndex = 0;
    let delayMinutes = 0;

    async function fetchData() {
      if (!currentClientId) return;
      try {
        const response = await fetch(\`/api/pis/data?clientId=\${currentClientId}\`);
        const data = await response.json();
        if (data.session) {
          updateDisplay(data.session);
        }
      } catch (e) {
        console.error('PIS fetch error:', e);
      }
    }

    function updateDisplay(session) {
      if (!session.timetable) return;
      currentTimetable = session.timetable;
      currentStopIndex = session.currentStopIndex;
      delayMinutes = session.delayMinutes;

      document.getElementById('lineNumber').textContent = session.timetable.route?.id || '--';
      document.getElementById('destination').textContent = session.timetable.route?.name || '--';

      const stops = session.timetable.stops || [];
      const currentStop = stops[currentStopIndex];
      const nextStop = stops[currentStopIndex + 1];

      if (currentStop) {
        document.getElementById('nextStop').textContent = currentStop.station?.name || '--';
        document.getElementById('arrivalTime').textContent = formatTime(currentStop.scheduledArrival);
        document.getElementById('departureTime').textContent = formatTime(currentStop.scheduledDeparture);
      }

      renderStopsList(stops);
    }

    function renderStopsList(stops) {
      const list = document.getElementById('stopsList');
      list.innerHTML = '';
      stops.forEach((stop, idx) => {
        const li = document.createElement('li');
        li.className = 'stop-item';
        if (idx < currentStopIndex) li.classList.add('completed');
        else if (idx === currentStopIndex) li.classList.add('current');
        else if (idx === currentStopIndex + 1) li.classList.add('next');

        li.innerHTML = \`
          <span class="stop-sequence">\${idx + 1}</span>
          <span class="stop-name">\${stop.station?.name || 'Unknown'}</span>
          <span class="stop-time">\${formatTime(stop.scheduledDeparture)}</span>
          \${delayMinutes > 0 && idx >= currentStopIndex ? \`<span class="delay-badge \${delayMinutes > 10 ? '' : 'minor'}">+\${delayMinutes} min</span>\` : ''}
        \`;
        list.appendChild(li);
      });
    }

    function formatTime(dateStr) {
      if (!dateStr) return '--:--';
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    function updateClock() {
      const now = new Date();
      document.getElementById('clock').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    }

    const urlParams = new URLSearchParams(window.location.search);
    currentClientId = urlParams.get('clientId');
    if (!currentClientId) {
      document.body.innerHTML = '<div style="padding: 40px; text-align: center; color: #888;">No client ID specified. Use ?clientId=XXX</div>';
    } else {
      fetchData();
      setInterval(fetchData, 5000);
      setInterval(updateClock, 1000);
      updateClock();
    }
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

async function servePISData(req: IncomingMessage, res: ServerResponse, clientId: string) {
  if (!clientId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'clientId required' }));
    return;
  }

  const session = await prisma.activeSession.findUnique({
    where: { clientId },
    include: {
      driver: { select: { name: true, forteId: true } },
      timetable: {
        include: {
          route: true,
          stops: {
            include: { station: true },
            orderBy: { stopSequenceIndex: 'asc' },
          },
        },
      },
    },
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ session }));
}

function serveStaticFile(req: IncomingMessage, res: ServerResponse, pathname: string) {
  const filePath = join(process.cwd(), 'public', pathname === '/' ? 'index.html' : pathname);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}
