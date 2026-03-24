const { db } = require("../db");

function addToQueue(action, payload) {
  db.prepare(
    `INSERT INTO sync_queue (action, payload, created_at) VALUES (?, ?, ?)`
  ).run(action, JSON.stringify(payload), new Date().toISOString());
}

function getPendingQueue() {
  return db
    .prepare(`SELECT * FROM sync_queue WHERE status='pending' ORDER BY id ASC`)
    .all();
}

function markDone(id) {
  db.prepare(`UPDATE sync_queue SET status='done' WHERE id=?`).run(id);
}

module.exports = { addToQueue, getPendingQueue, markDone };
