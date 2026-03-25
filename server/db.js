const Database = require("better-sqlite3");
const { getDbPaths } = require("./dbPaths");

const { dbPath, backupFolder } = getDbPaths();

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("busy_timeout = 10000");
db.pragma("cache_size = -16000");

module.exports = { db, dbPath, backupFolder };
