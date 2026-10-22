# Android tablet build (Capacitor)

```bash
cd client
npm install
npm run cap:add     # once: creates the android/ project
npm run cap:sync    # builds the web app with relative paths and copies it into android/
npm run cap:open    # opens Android Studio
```

Recommended manual tweaks in the generated `android/` project:

- `AndroidManifest.xml`, on the main activity: `android:screenOrientation="sensorLandscape"`.
- Keep the screen on: `getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)` in `MainActivity`.
- Immersive fullscreen: hide the system bars with `WindowInsetsControllerCompat` in `MainActivity`.
- Permissions: `ACCESS_FINE_LOCATION` (GPS) is needed for the geofence announcements.
- The OBU needs the server address: open **Settings** in the app and enter your server URL
  (default `https://railcon.corerail.dpdns.org`).

## Limitation: no PIS sub-server inside the Android app

The PIS sub-server (`client/pis/pis-server.cjs`) is a Node.js program. A Capacitor Android app runs only a WebView, so
**the `:8080` server is not started on Android**. Nothing in this repository replaces it there. On Android:

- The OBU still works fully. Without a PIS connection it speaks announcements and next-stop messages itself through the
  platform text-to-speech engine, and the Settings tab shows "PIS sub-server: not running".
- To get the passenger display, either
  - run `node client/pis/pis-server.cjs` (or the Electron app) on a laptop on the same network and point the tablet's
    PIS socket at it (not implemented: the OBU currently connects to `ws://127.0.0.1:8080` only), or
  - add a native local-HTTP-server plugin (for example `@capacitor-community/http-localserver`) that serves
    `pis/display.html` and relays the WebSocket frames. This is future work.
