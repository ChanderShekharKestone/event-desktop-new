// Backup, restore and full data wipe ("Clean All Data") for the host PC.
// Not in LAN_ALLOWED (server/index.js), so only reachable from this machine.
const router = require("express").Router();
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { db, dbPath, backupFolder } = require("../db");
const settings = require("../settings");

const USER_DATA = process.env.USER_DATA_PATH;
const SDK_FILES_DIR = USER_DATA
  ? path.join(USER_DATA, "sdk-files")
  : path.join(__dirname, "../../sdk-files");
const SETTINGS_PATH =
  process.env.SETTINGS_PATH ||
  (USER_DATA
    ? path.join(USER_DATA, "settings.json")
    : path.join(__dirname, "../../electron/settings.json"));

const TABLES = [
  "registrations",
  "attendee_types",
  "badge_templates",
  "registration_forms",
  "sdk_configs",
  "push_pending",
  "sync_queue",
  "sync_state",
  "app_settings",
];

// Electron APIs are available because the server runs inside the Electron main
// process. Under plain Node (npm run server) require("electron") is just a path string.
function getElectron() {
  try {
    const e = require("electron");
    return typeof e === "object" && e.app ? e : null;
  } catch {
    return null;
  }
}

const listFiles = (dir, ext) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(ext)) : [];

const pendingPushCount = () =>
  db.prepare("SELECT COUNT(*) AS c FROM push_pending").get().c;

function getSummary() {
  return {
    registrations: db.prepare("SELECT COUNT(*) AS c FROM registrations").get().c,
    events: db
      .prepare("SELECT COUNT(DISTINCT eventId) AS c FROM registrations")
      .get().c,
    pendingPush: pendingPushCount(),
    backups: listFiles(backupFolder, ".db").length,
    sdkFiles: listFiles(SDK_FILES_DIR, ".js").length,
    activated: !!settings.get("activated"),
  };
}

// "On this laptop" = system drive on Windows, not under /Volumes on macOS
function isOnLocalDrive(folder) {
  if (process.platform === "win32") {
    const sys = (process.env.SystemDrive || "C:").toUpperCase();
    return path.parse(folder).root.toUpperCase().startsWith(sys);
  }
  if (process.platform === "darwin") return !folder.startsWith("/Volumes/");
  return true;
}

// Attach native dialogs to the app window: without a parent they can open behind
// the window / unfocused, which looks like the export "hangs".
const parentWindow = (electron) =>
  electron.BrowserWindow.getFocusedWindow() || electron.BrowserWindow.getAllWindows()[0];

const showDialog = (electron, options) => {
  const win = parentWindow(electron);
  return win ? electron.dialog.showOpenDialog(win, options) : electron.dialog.showOpenDialog(options);
};

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

const CSV_COLUMNS = [
  "eventId", "cloudId", "firstName", "lastName", "email", "mobile",
  "organization", "designation", "type", "campaignSource", "paymentStatus",
  "amount", "isCheckedIn", "checkedInTime", "isPrintClicked", "termsAndCondn",
  "areaOfInterest", "customfields", "timestamp",
];

function toCsv(rows) {
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => esc(r[c])).join(","));
  // BOM so Excel opens UTF-8 names correctly
  return "﻿" + lines.join("\r\n");
}

// ── Summary ────────────────────────────────────────────────────────────────────

// GET /api/app-reset/summary
router.get("/summary", (_req, res) => {
  try {
    res.json({ status: 200, data: getSummary() });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// ── Export backup (.db + .csv) ─────────────────────────────────────────────────

// POST /api/app-reset/export — asks for a folder, writes a restorable .db and a .csv
router.post("/export", async (_req, res) => {
  const electron = getElectron();
  if (!electron) {
    return res.status(501).json({ status: 501, message: "Export is only available in the desktop app" });
  }
  try {
    const t0 = Date.now();
    const { canceled, filePaths } = await showDialog(electron, {
      title: "Choose a folder to save the backup (USB drive recommended)",
      buttonLabel: "Save Backup Here",
      properties: ["openDirectory", "createDirectory"],
    });
    if (canceled || !filePaths?.length) {
      return res.json({ status: 200, message: "Export cancelled", data: { canceled: true } });
    }

    const folder = filePaths[0];
    const tag = `${settings.get("eventId") || "all"}-${stamp()}`;
    const dbFile = path.join(folder, `vosmos-backup-${tag}.db`);
    const csvFile = path.join(folder, `registrations-${tag}.csv`);

    const t1 = Date.now();
    // Online backup API: consistent copy even while the app is writing
    await db.backup(dbFile);
    const t2 = Date.now();
    const rows = db.prepare("SELECT * FROM registrations ORDER BY eventId, id").all();
    fs.writeFileSync(csvFile, toCsv(rows));
    console.log(
      `[export] folder picker ${t1 - t0}ms, db backup ${t2 - t1}ms, csv ${Date.now() - t2}ms (${rows.length} rows)`,
    );

    res.json({
      status: 200,
      message: `Backup saved (${rows.length} registrations)`,
      data: { folder, dbFile, csvFile, registrations: rows.length, onLocalDrive: isOnLocalDrive(folder) },
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: `Export failed: ${err.message}` });
  }
});

// ── Restore from .db backup ────────────────────────────────────────────────────

// POST /api/app-reset/restore — asks for a .db file, validates it, replaces the DB and restarts
router.post("/restore", async (_req, res) => {
  const electron = getElectron();
  if (!electron) {
    return res.status(501).json({ status: 501, message: "Restore is only available in the desktop app" });
  }
  try {
    const pending = pendingPushCount();
    if (pending > 0) {
      return res.status(409).json({
        status: 409,
        message: `${pending} local change(s) not pushed to cloud. Push first — restore would overwrite them.`,
      });
    }

    const { canceled, filePaths } = await showDialog(electron, {
      title: "Choose a Vosmos backup (.db) to restore",
      buttonLabel: "Restore",
      properties: ["openFile"],
      filters: [{ name: "Vosmos backup", extensions: ["db"] }],
    });
    if (canceled || !filePaths?.length) {
      return res.json({ status: 200, message: "Restore cancelled", data: { canceled: true } });
    }
    const src = filePaths[0];

    // Validate: real SQLite file, not corrupt, has our tables
    let count;
    try {
      const check = new Database(src, { readonly: true, fileMustExist: true });
      const ok = check.pragma("quick_check", { simple: true });
      const tables = check
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((t) => t.name);
      const hasTables = ["registrations", "sync_state", "app_settings"].every((t) => tables.includes(t));
      count = hasTables ? check.prepare("SELECT COUNT(*) AS c FROM registrations").get().c : 0;
      check.close();
      if (ok !== "ok") throw new Error("file is corrupt");
      if (!hasTables) throw new Error("not a Vosmos Event backup");
    } catch (e) {
      return res.status(400).json({ status: 400, message: `Invalid backup: ${e.message}` });
    }

    res.json({
      status: 200,
      message: `Restoring ${count} registrations. The app will restart…`,
      data: { registrations: count },
    });

    // Replace DB after the response is sent, then relaunch (migrations run on start)
    setTimeout(() => {
      try {
        db.close();
        for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) fs.rmSync(f, { force: true });
        fs.copyFileSync(src, dbPath);
      } catch (e) {
        console.error("Restore failed:", e);
      }
      process.env.APP_SKIP_QUIT_BACKUP = "1";
      electron.app.relaunch();
      electron.app.exit(0);
    }, 500);
  } catch (err) {
    res.status(500).json({ status: 500, message: `Restore failed: ${err.message}` });
  }
});

// ── Clean all data ─────────────────────────────────────────────────────────────

// One active confirmation code at a time, single use, short-lived
let challenge = null;
const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion

function newCode() {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return `WIPE-${s}`;
}

// POST /api/app-reset/challenge — new confirmation code + what will be deleted
router.post("/challenge", (_req, res) => {
  try {
    const summary = getSummary();
    if (summary.pendingPush > 0) {
      challenge = null;
      return res.status(409).json({
        status: 409,
        message: `${summary.pendingPush} local change(s) not pushed to cloud. Push to Cloud first.`,
        data: summary,
      });
    }
    challenge = { code: newCode(), expiresAt: Date.now() + CHALLENGE_TTL_MS };
    res.json({ status: 200, data: { ...summary, code: challenge.code, expiresInSec: CHALLENGE_TTL_MS / 1000 } });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// POST /api/app-reset/wipe  { code }
router.post("/wipe", async (req, res) => {
  const { code } = req.body || {};
  const current = challenge;
  challenge = null; // single use — any attempt burns the code

  if (!current || Date.now() > current.expiresAt) {
    return res.status(400).json({ status: 400, message: "Confirmation code expired. Start again." });
  }
  if (typeof code !== "string" || code.trim().toUpperCase() !== current.code) {
    return res.status(400).json({ status: 400, message: "Confirmation code does not match." });
  }

  try {
    const pending = pendingPushCount();
    if (pending > 0) {
      return res.status(409).json({ status: 409, message: `${pending} local change(s) not pushed to cloud. Push first.` });
    }

    const before = getSummary();

    // 1. Database: empty every table, then VACUUM so deleted rows are not recoverable from the file
    db.transaction(() => {
      for (const t of TABLES) db.prepare(`DELETE FROM ${t}`).run();
      const hasSeq = db.prepare("SELECT 1 FROM sqlite_master WHERE name='sqlite_sequence'").get();
      if (hasSeq) db.prepare("DELETE FROM sqlite_sequence").run();
    })();
    db.exec("VACUUM");
    db.pragma("wal_checkpoint(TRUNCATE)");

    // 2. Files: DB backups (each is a full copy of attendee data) and SDK files
    for (const f of fs.existsSync(backupFolder) ? fs.readdirSync(backupFolder) : []) {
      fs.rmSync(path.join(backupFolder, f), { recursive: true, force: true });
    }
    for (const f of listFiles(SDK_FILES_DIR, ".js")) fs.rmSync(path.join(SDK_FILES_DIR, f), { force: true });

    // 3. Activation (license, eventId, expiry)
    fs.rmSync(SETTINGS_PATH, { force: true });

    // 4. Chromium storage (cache, cookies, local storage…)
    const electron = getElectron();
    if (electron) {
      const ses = electron.session.defaultSession;
      await ses.clearStorageData();
      await ses.clearCache();
      // Don't write a fresh backup of the (now empty) DB on quit
      process.env.APP_SKIP_QUIT_BACKUP = "1";
    }

    res.json({
      status: 200,
      message: "All data deleted. The app is now clean.",
      data: {
        registrations: before.registrations,
        events: before.events,
        backups: before.backups,
        sdkFiles: before.sdkFiles,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: `Clean failed: ${err.message}` });
  }
});

module.exports = router;
