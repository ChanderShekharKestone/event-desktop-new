const { db } = require("../db");

function addToQueue(action, payload, eventId = "") {
  db.prepare(
    `INSERT INTO sync_queue (action, payload, eventId, created_at) VALUES (?, ?, ?, ?)`
  ).run(action, JSON.stringify(payload), eventId || "", new Date().toISOString());
}

function getPendingQueue(eventId = null) {
  if (eventId) {
    return db
      .prepare(`SELECT * FROM sync_queue WHERE status='pending' AND eventId=? ORDER BY id ASC`)
      .all(eventId);
  }
  return db
    .prepare(`SELECT * FROM sync_queue WHERE status='pending' ORDER BY id ASC`)
    .all();
}

function markDone(id) {
  db.prepare(`UPDATE sync_queue SET status='done' WHERE id=?`).run(id);
}

module.exports = { addToQueue, getPendingQueue, markDone };
