import { config } from "./config.js";
import { nowSec } from "./time.js";
import { clients, pushFleet, sendObu, sessionDto, terminalIndexOf, type ClientState } from "./state.js";
import { deliverToObu } from "./engine.js";
import type { AdvisoryDto } from "./protocol.js";

/**
 * Automatic connection management (spec 6.C).
 *
 * For every pair of running trains on DIFFERENT lines that both serve the same junction station S:
 *   feeder  = train A (arrives at S)
 *   holder  = train B (would leave S)
 *   gap     = predictedArrival(A, S) - predictedDeparture(B, S)
 *
 *   0 < gap <= 120 s  -> B's OBU gets  "Hold 2 mins for connecting train <A>"
 *   gap  > 120 s      -> an existing hold is revoked with "Connection cancelled"
 *   gap <= 0, A already at S, or B already gone -> advisory silently disappears (connection made / moot)
 *
 * Predictions assume the current delay stays constant; trains are never predicted to leave early.
 */

interface Prediction {
  index: number;
  arr: number;
  dep: number;
  stationName: string;
  arrived: boolean; // already at / past this stop
  departed: boolean;
}

function predictions(c: ClientState, now: number): Map<number, Prediction> {
  const out = new Map<number, Prediction>();
  if (!c.run || !c.driver) return out;
  const terminal = terminalIndexOf(c);
  for (const s of c.run.stops) {
    if (s.index > terminal) continue;
    const atThis = s.index === c.currentStopIndex;
    const departed = s.index < c.currentStopIndex;
    const arrivedHere = atThis && c.phase === "AT_STOP";
    const arrDelay = arrivedHere ? (c.stopOffsets[s.index] ?? 0) * 60 : c.delaySec;
    const depDelay = Math.max(c.delaySec, 0);
    let dep = s.dep + c.scheduleShiftSec + depDelay;
    if (arrivedHere) dep = Math.max(dep, now); // cannot leave in the past
    out.set(s.stationId, {
      index: s.index,
      arr: s.arr + c.scheduleShiftSec + arrDelay,
      dep,
      stationName: s.name,
      arrived: departed || arrivedHere,
      departed,
    });
  }
  return out;
}

const hold = (a: ClientState) => `Hold 2 mins for connecting train ${a.run!.routeId} / ${a.run!.runNumber}`;
const CANCEL_TTL_MS = 30_000;

async function setAdvisory(b: ClientState, adv: AdvisoryDto, revoked: boolean) {
  if (revoked) {
    b.advisories.delete(adv.id.replace(/:cancel$/, ""));
    b.advisories.set(adv.id, adv);
  } else {
    b.advisories.set(adv.id, adv);
  }
  sendObu(b, { t: "session", session: sessionDto(b) });
  sendObu(b, { t: "advisory", advisory: adv, revoked });
  pushFleet(b);
  await deliverToObu(b, `${adv.text}${adv.detail ? " (" + adv.detail + ")" : ""}`, { popup: false });
}

let running = false;

export async function evaluateConnections() {
  if (running) return;
  running = true;
  try {
    const now = nowSec();
    const nowMs = Date.now();

    // Expire "Connection cancelled" notices
    for (const c of clients.values()) {
      let changed = false;
      for (const [id, adv] of c.advisories) {
        if (adv.kind === "CANCEL" && nowMs - adv.ts > CANCEL_TTL_MS) {
          c.advisories.delete(id);
          changed = true;
        }
      }
      if (changed) {
        sendObu(c, { t: "session", session: sessionDto(c) });
        pushFleet(c);
      }
    }

    const trains = [...clients.values()].filter((c) => c.run && c.driver);
    const preds = new Map(trains.map((c) => [c.clientId, predictions(c, now)]));
    const stillValid = new Set<string>(); // "<holderId>|<feederId>|<station>"

    for (const a of trains) {
      for (const b of trains) {
        if (a === b || a.run!.routeId === b.run!.routeId) continue;
        const pa = preds.get(a.clientId)!;
        const pb = preds.get(b.clientId)!;
        for (const [stationId, ia] of pa) {
          const ib = pb.get(stationId);
          if (!ib) continue; // not a junction for this pair
          if (ia.index === 1) continue; // A starts here, nothing to connect from
          const bTerminal = terminalIndexOf(b);
          if (ib.index >= bTerminal) continue; // B terminates here, no onward departure
          if (ib.departed || ia.arrived) continue; // moot: B left, or A is already here

          const gap = ia.arr - ib.dep;
          const key = `${b.clientId}|${a.clientId}|${stationId}`;
          if (gap > 0 && gap <= config.connectionWindowSec) {
            stillValid.add(key);
            if (!b.advisories.has(key)) {
              await setAdvisory(
                b,
                { id: key, kind: "HOLD", text: hold(a), detail: `at ${ia.stationName}`, ts: Date.now() },
                false
              );
            }
          } else if (gap > config.connectionWindowSec && b.advisories.get(key)?.kind === "HOLD") {
            await setAdvisory(
              b,
              { id: `${key}:cancel`, kind: "CANCEL", text: "Connection cancelled", detail: `${a.run!.routeId} / ${a.run!.runNumber} at ${ia.stationName}`, ts: Date.now() },
              true
            );
          }
        }
      }
    }

    // Remove stale HOLD advisories (connection made, train left, session ended, ...) silently.
    for (const c of clients.values()) {
      let changed = false;
      for (const [id, adv] of c.advisories) {
        if (adv.kind !== "HOLD") continue;
        if (!stillValid.has(id)) {
          c.advisories.delete(id);
          changed = true;
        }
      }
      if (changed) {
        sendObu(c, { t: "session", session: sessionDto(c) });
        pushFleet(c);
      }
    }
  } catch (e) {
    console.error("connection evaluation failed", e);
  } finally {
    running = false;
  }
}

let timer: NodeJS.Timeout | null = null;
export function scheduleEvaluate() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void evaluateConnections();
  }, 300);
}

export function startConnectionLoop() {
  setInterval(() => void evaluateConnections(), config.evaluateIntervalMs);
}
