"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("coreNative", {
  isElectron: true,
  getLocalIps: () => ipcRenderer.invoke("core:ips"),
  pisUrls: () => ipcRenderer.invoke("core:pisUrls"),
  quit: () => ipcRenderer.send("core:quit"),
});
