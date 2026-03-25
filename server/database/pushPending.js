const { db } = require("../db");

function addPending(registrationId, eventId) {
  db.prepare(
    `INSERT OR IGNORE INTO push_pending (registration_id, eventId, created_at) VALUES (?, ?, ?)`
  ).run(registrationId, eventId, new Date().toISOString());
}

function getPending(eventId) {
  return db.prepare(`SELECT * FROM push_pending WHERE eventId = ? ORDER BY created_at ASC`).all(eventId);
}

function removePending(registrationId, eventId) {
  db.prepare(`DELETE FROM push_pending WHERE registration_id = ? AND eventId = ?`).run(registrationId, eventId);
}

function getPendingCount(eventId) {
  return db.prepare(`SELECT COUNT(*) as count FROM push_pending WHERE eventId = ?`).get(eventId).count;
}

module.exports = { addPending, getPending, removePending, getPendingCount };
