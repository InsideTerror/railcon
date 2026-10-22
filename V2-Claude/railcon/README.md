# C.O.R.E. - Corporation Of Railway Engineering

Train fleet operation, telemetry and Passenger Information System (PIS), modelled after transit systems such as BKV FUTÁR.
All UI text, seeded data, logs and notifications are in English.

> **Status: not yet compiled or run end to end.** The code was written in an environment that could not install npm
> packages, so `npm install`, `prisma generate`, `tsc` and the full stack have never been executed. Only the PIS
> sub-server was run and tested (WebSocket relay, static routes). Expect to fix some type or runtime errors on first build.

## Architecture

```
  OBU (React/PWA, Electron, Capacitor)                       Dispatcher / Sysadmin (browser)
        |   wss://railcon.corerail.dpdns.org/ws/obu                  |  wss://dash.corerail.dpdns.org/ws/dash
        v                                                            v
  +-------------------------- Fastify + ws server (:3000) ---------------------------+
  |  engine (login, runs, stops, delay)   connection manager (junction holds)         |
  |  REST: /api/auth, /api/dispatch, /api/admin   GTFS + CSV ingestion                |
  +---------------------------------- Prisma -----------------------------------------+
                                         |
                                    PostgreSQL

  OBU --ws://127.0.0.1:8080/ws?role=obu--> PIS sub-server (:8080) --ws?role=display--> /passenger-display
```

Both hostnames point at the same Fastify process through one Cloudflare Tunnel (`deploy/cloudflared.yml`).
The wire protocol is defined in `server/src/protocol.ts` (copy in `client/src/lib/protocol.ts`; keep both in sync).

## Layout

| Path | Contents |
|---|---|
| `server/prisma/schema.prisma` | PostgreSQL schema: users, routes, stations, route_stops, timetables, timetable_stops, active_sessions, messages, canned_options (+ duty_logs) |
| `server/src/` | Fastify app, WebSocket handlers, live engine (`engine.ts`, `state.ts`), `connections.ts`, `ingest/` (GTFS, CSV), `seedCore.ts` |
| `client/src/obu/` | Driver OBU UI: header, route progress strip, 5 tabs, bottom action strip |
| `client/src/dash/` | Dispatcher dashboard |
| `client/src/admin/` | Sysadmin portal (CRUD + data import) |
| `client/pis/` | PIS sub-server (`pis-server.cjs`) and passenger display (`display.html`) |
| `client/electron/`, `client/capacitor.config.ts`, `client/ANDROID.md` | Desktop kiosk and Android wrappers |
| `deploy/` | Cloudflare Tunnel config and systemd units |

## Quick start (development)

```bash
docker compose up -d db                      # PostgreSQL 16
cd server && cp .env.example .env
npm install                                  # run once at the repo root: npm workspaces
npx prisma migrate dev --name init
npm run dev                                  # server on :3000, seeds data on first start
# second terminal
cd client && npm run dev                     # Vite on :5173, proxies /api and /ws to :3000
npm run pis                                  # optional: PIS sub-server on :8080
```

| App | URL |
|---|---|
| OBU | http://localhost:5173/ |
| Dispatcher dashboard | http://localhost:5173/dash (also the default on a host starting with `dash.`) |
| Sysadmin portal | http://localhost:5173/admin |
| Passenger display | http://localhost:8080/passenger-display |

### Seeded logins (change them)

| Role | Forte ID | PIN |
|---|---|---|
| Driver | `856` (John Smith), `857` (Anna Kovacs) | `123456` |
| Dispatcher | `9001` | `654321` |
| Sysadmin | `9999` | `99999999` |

Seeding runs only on an empty database. In production set `SEED_DRIVER_PIN`, `SEED_DISPATCHER_PIN`, `SEED_SYSADMIN_PIN`
and `JWT_SECRET` before the first start (the server refuses to start in production without them). The demo network has
lines S70 (Budapest-Nyugati - Esztergom) and S71 (Vác - Budapest-Kelenföld) which meet at Újpest, so connection holds can be tried by
running one train on each line.

## Behaviour reference

**Delay badge (OBU header, per-stop chips):** green when on time or early up to 30 s (<= 0 min); yellow 1-5 min; amber 6-10 min
(the specification leaves this band undefined; this is a documented choice); red above 10 min. A red pulsing **EARLY!** is shown when
doors close more than 30 s before the scheduled departure.

**Route progress strip:** completed stops grey; the active stop is **white** while approaching and **yellow** after arrival (doors open,
pending confirmation); cancelled stops struck through as "Not served"; each served stop shows its measured offset.

**Bottom strip:** red PANIC button (confirmation dialog, alert pinned on the dashboard until acknowledged) and the door / manual-step
controls. *Arrived · Open doors* measures delay against the scheduled arrival, *Close doors · Depart* against the scheduled departure and
advances to the next stop. *Manual step* advances without door events.

**Connection management (server, every 10 s and on every state change):** for two trains on different lines that share a junction station, if the
feeder is predicted to arrive 0-120 s after the holding train's predicted departure, the holding train's OBU gets
*"Hold 2 mins for connecting train X"*. If the gap grows beyond 120 s the hold is revoked with *"Connection cancelled"* (shown for 30 s).
Predictions assume the current delay stays constant.

**Dispatcher commands:** truncate/cancel remaining stops, schedule override (set offset or shift the timetable), relief runs (clone of an existing run,
optionally shifted and assigned to a device), broadcast pop-ups (shown for 10 s), remote session terminate (driver, route or both).

**Dashboard filters:** *Active* = driver and route; *Idle* = driver without route or route without driver; *Non-Active* = connected, unauthenticated.

**PIS:** the OBU pushes state, door-close/geofence events and announcements to `ws://127.0.0.1:8080`. The display speaks with the Web Speech API
(`en-GB`); it first tries `/audio/<slug>.mp3` from `client/pis/audio/` and falls back to text-to-speech. The geofence is a 300 m radius around the
next station's optional `lat`/`lon`.

## Data import (Sysadmin portal > Data Import)

* **GTFS zip:** `routes.txt`, `stops.txt`, `trips.txt`, `stop_times.txt`. Stops of each trip are renumbered to `stop_sequence_index` 1..N.
  Optional `serviceId` filter (feeds hold many days) and trip cap.
* **Custom CSV:** `RouteID, RunNumber, StationName, ScheduledArrival, ScheduledDeparture, SequenceIndex`, times as `HH:MM[:SS]`, header row optional.

```csv
RouteID,RunNumber,StationName,ScheduledArrival,ScheduledDeparture,SequenceIndex
S70,0101,Budapest-Nyugati,06:00,06:00,1
S70,0101,Újpest,06:12,06:13,2
S70,0101,Esztergom,07:05,07:05,3
```

## Production on Debian + Cloudflare Tunnel

```bash
npm install && npm run build                 # builds client/dist, then server/dist
sudo mkdir -p /opt/core /etc/core && sudo cp -r server client /opt/core/   # plus the root package.json
sudo cp deploy/core-server.service deploy/cloudflared.service /etc/systemd/system/
# /etc/core/server.env: DATABASE_URL, JWT_SECRET, SEED_*_PIN, SERVICE_TZ, CLIENT_DIST
cd /opt/core/server && npx prisma migrate deploy
sudo systemctl enable --now core-server cloudflared
```

Edit `deploy/cloudflared.yml` with your tunnel UUID first. OBU clients default to `https://railcon.corerail.dpdns.org`
(changeable on the Settings tab).

## Desktop and Android clients

```bash
cd client
npm run electron:dev                         # builds with relative paths and opens Electron (add -- --kiosk for kiosk mode)
npm run electron:build                       # AppImage + deb
```

Electron starts the PIS sub-server itself. Android: see `client/ANDROID.md`.

## Known limitations

* Never compiled or run end to end (see the status note). The server's Prisma-typed code and all React code are unchecked.
* Android cannot host the PIS server in-process; the OBU falls back to speaking on the device itself.
* Brightness is a software dim only.
* Dashboard: if the login token (12 h) expires while the page stays open, the feed keeps retrying instead of returning to login.
* Live sessions of logged-in OBUs survive a server restart and 10 minutes of GSM loss; anything older is dropped.
* Passenger announcements are logged to the message archive; the TTS runs on the PIS display (or the OBU if no PIS is running).
