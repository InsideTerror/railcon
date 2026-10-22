import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.corerail.obu",
  appName: "CORE OBU",
  webDir: "dist",
  server: { androidScheme: "https" },
  backgroundColor: "#05070a",
};

export default config;
