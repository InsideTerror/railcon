import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { detectMode } from "./lib/config";
import { ObuApp } from "./obu/ObuApp";
import { DashApp } from "./dash/DashApp";
import { AdminApp } from "./admin/AdminApp";

const mode = detectMode();
document.title = mode === "dash" ? "C.O.R.E. Dispatch" : mode === "admin" ? "C.O.R.E. Admin" : "C.O.R.E. OBU";

if (mode === "obu" && "serviceWorker" in navigator && location.protocol.startsWith("http") && location.port !== "5173") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{mode === "dash" ? <DashApp /> : mode === "admin" ? <AdminApp /> : <ObuApp />}</React.StrictMode>
);
