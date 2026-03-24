const { db } = require("../db");

function addPending(registrationId) {
  // INSERT OR IGNORE — deduplicates: multiple updates before push = one entry
  db.prepare(
    `INSERT OR IGNORE INTO push_pending (registration_id, created_at) VALUES (?, ?)`
  ).run(registrationId, new Date().toISOString());
}

function getPending() {
  return db.prepare(`SELECT * FROM push_pending ORDER BY created_at ASC`).all();
}

function removePending(registrationId) {
  db.prepare(`DELETE FROM push_pending WHERE registration_id = ?`).run(registrationId);
}

module.exports = { addPending, getPending, removePending };
