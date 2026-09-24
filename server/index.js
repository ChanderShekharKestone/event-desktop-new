const express = require("express");
const cors = require("cors");
const https = require("https");
const os = require("os");
const path = require("path");

const selfsigned = require("selfsigned");
const { PORT, HTTPS_PORT } = require("./config");
const KIOSK_PORT = HTTPS_PORT;
const KIOSK_PROTOCOL = "https";
const SDK_FILES_DIR = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, "sdk-files")
  : path.join(__dirname, "../sdk-files");
const runMigrations = require("./migrations");
const { syncFromCloud } = require("./services/cloudSync");
const { pushLocalChanges } = require("./services/pushSync");

const app = express();
// Determine local IP synchronously so the HTTPS cert SAN can include it
let localIP = "localhost";
const nets = os.networkInterfaces();
for (const name of Object.keys(nets)) {
  for (const net of nets[name]) {
    if (net.family === "IPv4" && !net.internal) {
      localIP = net.address;
      break;
    }
  }
}

// CORS — only the Electron renderer (file:// sends Origin "null"), the React dev
// server, and pages served by this server itself (LAN devices). Blocks random
// websites open in a browser on this PC from reading the local API.
const DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
app.use(
  cors((req, callback) => {
    const origin = req.header("Origin");
    let sameHost = false;
    try {
      sameHost = !!origin && new URL(origin).host === req.headers.host;
    } catch {}
    const allowed =
      !origin || origin === "null" || DEV_ORIGINS.includes(origin) || sameHost;
    callback(null, {
      origin: allowed,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      credentials: true,
    });
  }),
);

app.use(express.json());

// Serve downloaded SDK JS files statically
app.use("/sdk-files", express.static(SDK_FILES_DIR));

// Serve React build for LAN users
const BUILD_DIR = path.join(__dirname, "../build");
app.use(express.static(BUILD_DIR));

// Serve public folder (widget.js etc.)
const PUBLIC_DIR = path.join(__dirname, "../public");
app.use(express.static(PUBLIC_DIR));

// LAN devices may only register and scan. Everything else (sync, activation,
// settings, registration list, seed...) is restricted to this PC.
const LAN_ALLOWED = [
  ["GET", /^\/api\/health$/],
  ["GET", /^\/api\/sdk-configs$/],
  ["GET", /^\/api\/registration-fields\/by-type\/[^/]+$/],
  ["POST", /^\/api\/registrations$/],
  ["GET", /^\/api\/attendee-types$/],
  ["GET", /^\/api\/badge-templates$/],
  ["POST", /^\/api\/scan\/(checkin|search)$/],
];
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

app.use("/api", (req, res, next) => {
  if (LOOPBACK.has(req.socket.remoteAddress)) return next();
  const urlPath = req.originalUrl.split("?")[0];
  const ok = LAN_ALLOWED.some(([m, re]) => m === req.method && re.test(urlPath));
  if (ok) return next();
  res.status(403).json({ status: 403, message: "Not allowed from network devices" });
});

// Routes
app.use("/api/activation", require("./routes/activation"));
app.use("/api/registrations", require("./routes/registrations"));
app.use("/api/sync", require("./routes/sync"));
app.use("/api/scan", require("./routes/scan"));
app.use("/api/attendee-types", require("./routes/attendeeTypes"));
app.use("/api/badge-templates", require("./routes/badgeTemplates"));
app.use("/api/app-settings", require("./routes/appSettings"));
app.use("/api/sdk-configs", require("./routes/sdkConfigs"));
app.use("/api/registration-fields", require("./routes/registrationFields"));
// Test-data endpoints (seed / wipe) only in development
if (!process.env.APP_PACKAGED) app.use("/api/seed", require("./routes/seed"));

// Health check
app.get("/api/health", (_req, res) => res.json({ status: 200, message: "OK" }));

// Run DB migrations and start server
runMigrations();

app.get("/api/local-ip", (_req, res) => {
  const nets = os.networkInterfaces();
  let ip = "localhost";
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        ip = net.address;
        break;
      }
    }
  }
  res.json({ ip, port: KIOSK_PORT, protocol: KIOSK_PROTOCOL });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`LAN registration URL: http://${localIP}:${PORT}/#/register?type=attendee`);
});

// HTTPS server for kiosk — browsers require secure context for camera access
// SAN (Subject Alternative Name) is required by Chrome 58+; without it the browser
// raises ERR_SSL_PROTOCOL_ERROR instead of the usual "proceed anyway" warning.
const attrs = [{ name: "commonName", value: localIP }];
const pems = selfsigned.generate(attrs, {
  days: 365,
  extensions: [
    {
      name: "subjectAltName",
      altNames: [
        { type: 7, ip: "127.0.0.1" },
        { type: 7, ip: localIP },
        { type: 2, value: "localhost" },
      ],
    },
  ],
});
https.createServer({ key: pems.private, cert: pems.cert }, app).listen(HTTPS_PORT, () => {
  console.log(`HTTPS server running on https://localhost:${HTTPS_PORT}`);
});

// Background sync intervals
setInterval(() => syncFromCloud(), 5 * 60 * 1000); // every 5 min
setInterval(() => pushLocalChanges(), 2 * 60 * 1000); // every 2 min

// Initial cloud sync on startup
syncFromCloud().catch(console.error);

module.exports = app;
