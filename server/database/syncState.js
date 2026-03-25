const { db } = require("../db");

function getLastSync(eventId) {
  const row = db.prepare("SELECT last_sync FROM sync_state WHERE eventId = ?").get(eventId);
  return row ? row.last_sync : null;
}

function updateLastSync(time, eventId) {
  db.prepare(
    `INSERT INTO sync_state (eventId, last_sync) VALUES (?, ?)
     ON CONFLICT(eventId) DO UPDATE SET last_sync = excluded.last_sync`
  ).run(eventId, time);
}

function clearSyncState(eventId) {
  db.prepare(`DELETE FROM sync_state WHERE eventId = ?`).run(eventId);
}

module.exports = { getLastSync, updateLastSync, clearSyncState };
