const express = require("express");
const cors = require("cors");
const os = require("os");
const path = require("path");
const { PORT } = require("./config");
const SDK_FILES_DIR = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, "sdk-files")
  : path.join(__dirname, "../sdk-files");
const runMigrations = require("./migrations");
const { syncFromCloud } = require("./services/cloudSync");
const { pushLocalChanges } = require("./services/pushSync");

const app = express();
let localIP = "localhost";

// CORS — allow React dev server and Electron renderer
// app.use(cors({
//   origin: "*",
//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
// }));

// const corsOptions = {
//   origin: ["http://localhost:3000", "http://localhost:4001"],
//   methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//   credentials: true,
// };
// app.use(cors(corsOptions));

app.use(
  cors({
    origin: (_origin, callback) => callback(null, true),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  }),
);

app.use(express.json());

// Serve downloaded SDK JS files statically
app.use("/sdk-files", express.static(SDK_FILES_DIR));

// Serve React build for LAN users
const BUILD_DIR = path.join(__dirname, "../build");
app.use(express.static(BUILD_DIR));

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

// Health check
app.get("/api/health", (_req, res) => res.json({ status: 200, message: "OK" }));

// Run DB migrations and start server
runMigrations();

app.get("/api/local-ip", (_req, res) => res.json({ ip: localIP, port: PORT }));

app.listen(PORT, () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `LAN registration URL: http://${localIP}:${PORT}/#/register?type=attendee`,
  );
});

// Background sync intervals
setInterval(() => syncFromCloud(), 5 * 60 * 1000); // every 5 min
setInterval(() => pushLocalChanges(), 2 * 60 * 1000); // every 2 min

// Initial cloud sync on startup
syncFromCloud().catch(console.error);

module.exports = app;
