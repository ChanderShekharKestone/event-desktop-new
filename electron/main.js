const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

// Prevent a second instance from opening the same SQLite database concurrently.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

process.env.USER_DATA_PATH = app.getPath("userData");
// Server always runs embedded inside Electron (dev and production).
require("../server/index");
const { getDbPaths } = require("../server/dbPaths");
const { backupFolder, dbPath } = getDbPaths();

let mainWindow = null;

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, "../public/favicon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }

  // Disable page refresh shortcuts
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const isRefresh =
      input.key === "F5" ||
      (input.key === "r" && (input.control || input.meta));
    if (isRefresh) event.preventDefault();
  });
}

app.whenReady().then(createWindow);

// Backup database when app closes
app.on("before-quit", () => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dest = path.join(backupFolder, `app_data_${timestamp}.db`);
    fs.copyFileSync(dbPath, dest);
    console.log("Database backup created:", dest);
  } catch (err) {
    console.error("Failed to backup database:", err);
  }
});
