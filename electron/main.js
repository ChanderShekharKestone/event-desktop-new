const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;

// Refuse to start with a Chromium remote-debugging port in production
// (Node --inspect is already disabled via electron fuses in package.json).
if (!isDev && app.commandLine.hasSwitch("remote-debugging-port")) {
  app.quit();
  process.exit(0);
}

// Prevent a second instance from opening the same SQLite database concurrently.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

process.env.USER_DATA_PATH = app.getPath("userData");
process.env.APP_PACKAGED = isDev ? "" : "1";
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

// Production: no Reload / Toggle DevTools menu items. macOS keeps App + Edit
// menus so Quit and copy/paste shortcuts still work in form fields.
function setAppMenu() {
  if (isDev) return;
  if (process.platform === "darwin") {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, process.platform === "darwin" ? "../public/icon.icns" : "../public/icon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }

  // Disable page refresh and (in production) DevTools shortcuts
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const key = input.key.toLowerCase();
    const mod = input.control || input.meta;
    const isRefresh = input.key === "F5" || (key === "r" && mod);
    const isDevTools =
      input.key === "F12" ||
      (mod && input.shift && (key === "i" || key === "j" || key === "c")) ||
      (input.meta && input.alt && key === "i");
    if (isRefresh || (!isDev && isDevTools)) event.preventDefault();
  });

  // Never open new windows (window.open / target=_blank)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Only allow navigation within the app itself (hash routes are in-page and unaffected)
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (new URL(url).origin !== new URL(current).origin) event.preventDefault();
  });
}

app.whenReady().then(() => {
  setAppMenu();
  createWindow();
});

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
