"use strict";
const { app, BrowserWindow, ipcMain, powerSaveBlocker, globalShortcut } = require("electron");
const path = require("node:path");

const kiosk = process.argv.includes("--kiosk") || process.env.CORE_KIOSK === "1";
let pis = null;
let win = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    const pisPath = path.join(__dirname, "..", "pis", "pis-server.cjs");
    const pisMod = require(pisPath);
    pis = pisMod.start();

    ipcMain.handle("core:ips", () => pisMod.lanAddresses());
    ipcMain.handle("core:pisUrls", () => [`http://localhost:${process.env.PIS_PORT || 8080}/passenger-display`, ...pisMod.lanAddresses().map((ip) => `http://${ip}:${process.env.PIS_PORT || 8080}/passenger-display`)]);
    ipcMain.on("core:quit", () => {
      if (!kiosk) app.quit();
    });

    powerSaveBlocker.start("prevent-display-sleep");

    win = new BrowserWindow({
      width: 1366,
      height: 768,
      fullscreen: kiosk,
      kiosk,
      autoHideMenuBar: true,
      backgroundColor: "#05070a",
      webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.setMenuBarVisibility(false);

    const devUrl = process.env.CORE_DEV_URL;
    if (devUrl) win.loadURL(devUrl);
    else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

    // The app may only talk to its own origin; no popups, no navigation away.
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e, url) => {
      if (!url.startsWith("file://") && !(devUrl && url.startsWith(devUrl))) e.preventDefault();
    });

    globalShortcut.register("F11", () => {
      if (win) win.setFullScreen(!win.isFullScreen());
    });
    if (!kiosk) globalShortcut.register("CommandOrControl+Shift+Q", () => app.quit());
  });

  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    pis?.close();
  });
}
