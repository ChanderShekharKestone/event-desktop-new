const { db } = require("../db");

function getLastSync() {
  const row = db.prepare("SELECT last_sync FROM sync_state WHERE id=1").get();
  return row ? row.last_sync : null;
}

function updateLastSync(time) {
  db.prepare(
    `INSERT INTO sync_state (id, last_sync) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET last_sync = excluded.last_sync`
  ).run(time);
}

module.exports = { getLastSync, updateLastSync };
