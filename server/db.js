const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const userDataPath = process.env.USER_DATA_PATH;

const dbPath =
  process.env.DB_PATH ||
  (userDataPath
    ? path.join(userDataPath, "app_data.db")
    : path.join(__dirname, "../electron/app_data.db"));

const backupFolder = userDataPath
  ? path.join(userDataPath, "backup")
  : path.join(__dirname, "../electron/backup");

// Ensure parent directories exist
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
if (!fs.existsSync(backupFolder)) {
  fs.mkdirSync(backupFolder, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 10000");
db.pragma("cache_size = -16000");

module.exports = { db, dbPath, backupFolder };
