"use strict";
/**
 * C.O.R.E. PIS sub-server - runs locally on every OBU device.
 *   http://<device-ip>:8080/passenger-display   full-screen passenger display
 *   ws://<device-ip>:8080/ws?role=obu           the OBU app pushes state / events / announcements
 *   ws://<device-ip>:8080/ws?role=display       passenger display(s) receive everything
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { WebSocketServer, WebSocket } = require("ws");

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === "IPv4" && !i.internal) out.push(i.address);
  }
  return out;
}

const MIME = { ".html": "text/html; charset=utf-8", ".mp3": "audio/mpeg", ".json": "application/json" };

function start({ port = Number(process.env.PIS_PORT) || 8080, host = "0.0.0.0" } = {}) {
  let lastState = null;
  const audioDir = path.join(__dirname, "audio");

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    const send = (code, body, type = "text/plain; charset=utf-8", extra = {}) => {
      res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", ...extra });
      res.end(body);
    };

    if (url.pathname === "/") {
      res.writeHead(302, { Location: "/passenger-display" });
      return res.end();
    }
    if (url.pathname === "/passenger-display") {
      return fs.readFile(path.join(__dirname, "display.html"), (err, buf) =>
        err ? send(500, "display.html missing") : send(200, buf, MIME[".html"])
      );
    }
    if (url.pathname === "/state") {
      return send(200, JSON.stringify(lastState), MIME[".json"], { "Access-Control-Allow-Origin": "*" });
    }
    if (url.pathname === "/health") return send(200, JSON.stringify({ ok: true }), MIME[".json"]);

    if (url.pathname.startsWith("/audio/")) {
      const name = decodeURIComponent(url.pathname.slice("/audio/".length));
      if (!/^[a-z0-9][a-z0-9-]*\.mp3$/.test(name)) return send(404, "Not found");
      const file = path.join(audioDir, name);
      if (path.dirname(file) !== audioDir) return send(404, "Not found");
      return fs.readFile(file, (err, buf) => (err ? send(404, "Not found") : send(200, buf, MIME[".mp3"], { "Cache-Control": "public, max-age=3600" })));
    }
    send(404, "Not found");
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
  const displays = new Set();

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", "http://localhost");
    const role = url.searchParams.get("role");
    if (url.pathname !== "/ws" || (role !== "obu" && role !== "display")) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.isAlive = true;
      ws.on("pong", () => (ws.isAlive = true));
      ws.on("error", () => ws.terminate());
      if (role === "display") {
        displays.add(ws);
        ws.on("close", () => displays.delete(ws));
        if (lastState) ws.send(JSON.stringify({ t: "state", state: lastState }));
      } else {
        ws.on("message", (raw) => {
          let frame;
          try {
            frame = JSON.parse(raw.toString());
          } catch {
            return;
          }
          if (!frame || typeof frame.t !== "string") return;
          if (frame.t === "state" && frame.state) lastState = frame.state;
          const data = JSON.stringify(frame);
          for (const d of displays) if (d.readyState === WebSocket.OPEN) d.send(data);
        });
      }
    });
  });

  const hb = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 20000);

  server.listen(port, host, () => {
    console.log(`[PIS] listening on port ${port}`);
    console.log(`[PIS] http://localhost:${port}/passenger-display`);
    for (const ip of lanAddresses()) console.log(`[PIS] http://${ip}:${port}/passenger-display`);
  });
  server.on("error", (e) => console.error("[PIS] server error:", e.message));

  return {
    server,
    getState: () => lastState,
    close: () => {
      clearInterval(hb);
      for (const ws of wss.clients) ws.terminate();
      server.close();
    },
  };
}

module.exports = { start, lanAddresses };

if (require.main === module) start();
