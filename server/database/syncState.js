const { db } = require("../db");

function getLastSync(eventId) {
  const row = db.prepare("SELECT last_sync FROM sync_state WHERE eventId = ?").get(eventId);
  return row ? row.last_sync : null;
}

function updateLastSync(time, eventId) {
  const exists = db.prepare(`SELECT 1 FROM sync_state WHERE eventId = ?`).get(eventId);
  if (exists) {
    db.prepare(`UPDATE sync_state SET last_sync = ? WHERE eventId = ?`).run(time, eventId);
  } else {
    db.prepare(`INSERT INTO sync_state (eventId, last_sync) VALUES (?, ?)`).run(eventId, time);
  }
}

function clearSyncState(eventId) {
  db.prepare(`DELETE FROM sync_state WHERE eventId = ?`).run(eventId);
}

module.exports = { getLastSync, updateLastSync, clearSyncState };
