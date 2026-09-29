const { db } = require("../db");

// Same audience as the cloud giveaway page: delegate / moderator / exhibitor / speaker
const GIVEAWAY_ROLE_IDS = ["vos78", "vos82", "vos68", "vos58"];
const ROLE_PLACEHOLDERS = GIVEAWAY_ROLE_IDS.map(() => "?").join(", ");

const norm = (email) => (email || "").toLowerCase().trim();

function findRegistration(eventId, email) {
  return db
    .prepare(`SELECT id, email, cloudId FROM registrations WHERE eventId = ? AND LOWER(email) = ?`)
    .get(eventId, norm(email));
}

// An assignment belongs to a delegate by email, or by cloud id when the cloud
// assignment arrived before the delegate was pulled locally
function findAssignment(eventId, giveawayId, email, cloudId) {
  return db
    .prepare(
      `SELECT id FROM giveaway_assignments
       WHERE event_id = ? AND giveaway_id = ?
         AND (email = ? OR (attendee_cloud_id IS NOT NULL AND attendee_cloud_id = ?))`,
    )
    .get(eventId, giveawayId, norm(email), cloudId ?? null);
}

function insertAssignment(eventId, giveawayId, email, cloudId, assignedAt) {
  db.prepare(
    `INSERT INTO giveaway_assignments (event_id, giveaway_id, email, attendee_cloud_id, assigned_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(eventId, giveawayId, email ? norm(email) : null, cloudId ?? null, assignedAt);
}

function deleteAssignment(eventId, giveawayId, email, cloudId) {
  db.prepare(
    `DELETE FROM giveaway_assignments
     WHERE event_id = ? AND giveaway_id = ?
       AND (email = ? OR (attendee_cloud_id IS NOT NULL AND attendee_cloud_id = ?))`,
  ).run(eventId, giveawayId, norm(email), cloudId ?? null);
}

function getGiveawayRow(eventId, giveawayId) {
  return db
    .prepare(`SELECT * FROM giveaways WHERE event_id = ? AND cloud_id = ?`)
    .get(eventId, giveawayId);
}

function toGiveaway(row) {
  const assigned = db
    .prepare(`SELECT COUNT(*) AS c FROM giveaway_assignments WHERE event_id = ? AND giveaway_id = ?`)
    .get(row.event_id, row.cloud_id).c;
  return {
    _id: row.cloud_id,
    title: row.title,
    totalQuantity: row.total_quantity,
    remainingQuantity: Math.max(0, row.total_quantity - assigned),
    assignedCount: assigned,
  };
}

function getGiveaways(eventId) {
  return db
    .prepare(`SELECT * FROM giveaways WHERE event_id = ? ORDER BY created_at ASC, id ASC`)
    .all(eventId)
    .map(toGiveaway);
}

/**
 * Replace local giveaways + assignments with the cloud copy, then re-apply the
 * ops not pushed yet so offline work is not lost.
 */
const replaceFromCloud = db.transaction((eventId, giveaways) => {
  const cloudIds = giveaways.map((g) => g._id);
  const upsert = db.prepare(
    `INSERT INTO giveaways (cloud_id, event_id, title, total_quantity, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(cloud_id, event_id) DO UPDATE SET
       title = excluded.title, total_quantity = excluded.total_quantity,
       created_at = excluded.created_at, updated_at = excluded.updated_at`,
  );
  for (const g of giveaways) {
    upsert.run(g._id, eventId, g.title || "", g.totalQuantity || 0, g.createdAt ?? null, g.updatedAt ?? null);
  }

  // Giveaways deleted on the cloud
  const stale = db
    .prepare(`SELECT cloud_id FROM giveaways WHERE event_id = ?`)
    .all(eventId)
    .map((r) => r.cloud_id)
    .filter((id) => !cloudIds.includes(id));
  for (const id of stale) {
    db.prepare(`DELETE FROM giveaways WHERE event_id = ? AND cloud_id = ?`).run(eventId, id);
    db.prepare(`DELETE FROM giveaway_ops WHERE event_id = ? AND giveaway_id = ?`).run(eventId, id);
  }

  // Cloud attendee id → local email
  const emailByCloudId = new Map(
    db
      .prepare(`SELECT cloudId, LOWER(email) AS email FROM registrations WHERE eventId = ? AND cloudId IS NOT NULL`)
      .all(eventId)
      .map((r) => [r.cloudId, r.email]),
  );

  db.prepare(`DELETE FROM giveaway_assignments WHERE event_id = ?`).run(eventId);
  for (const g of giveaways) {
    for (const a of g.assignedTo || []) {
      const cloudId = String(a.attendeeId);
      insertAssignment(eventId, g._id, emailByCloudId.get(cloudId) || null, cloudId, a.assignedAt ?? null);
    }
  }

  for (const op of getOps(eventId, "pending")) {
    const reg = findRegistration(eventId, op.email);
    const existing = findAssignment(eventId, op.giveaway_id, op.email, reg?.cloudId);
    if (op.action === "assign" && !existing) {
      insertAssignment(eventId, op.giveaway_id, op.email, reg?.cloudId, op.created_at);
    } else if (op.action === "revert" && existing) {
      deleteAssignment(eventId, op.giveaway_id, op.email, reg?.cloudId);
    }
  }
});

/** Paginated delegates with the ids of the giveaways each one has */
function getAttendees(eventId, { page = 1, limit = 10, q = "" }) {
  const conditions = ["eventId = ?", "isActive = 1", `roleId IN (${ROLE_PLACEHOLDERS})`];
  const params = [eventId, ...GIVEAWAY_ROLE_IDS];

  const tokens = q.trim() ? q.trim().split(/\s+/) : [];
  for (const t of tokens) {
    conditions.push(
      `(firstName LIKE ? OR lastName LIKE ? OR email LIKE ? OR mobile LIKE ? OR organization LIKE ? OR designation LIKE ? OR type LIKE ?)`,
    );
    params.push(...Array(7).fill(`%${t}%`));
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const total = db.prepare(`SELECT COUNT(*) AS c FROM registrations ${where}`).get(params).c;
  const rows = db
    .prepare(
      `SELECT id, cloudId, firstName, lastName, email, organization, designation, type, roleId
       FROM registrations ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
    .all([...params, limit, (page - 1) * limit]);

  const assignments = db
    .prepare(`SELECT giveaway_id, email, attendee_cloud_id FROM giveaway_assignments WHERE event_id = ?`)
    .all(eventId);

  const list = rows.map((r) => {
    const email = norm(r.email);
    const giveawayIds = assignments
      .filter((a) => a.email === email || (r.cloudId && a.attendee_cloud_id === r.cloudId))
      .map((a) => a.giveaway_id);
    return { ...r, _id: r.id, email: r.email, giveawayIds: [...new Set(giveawayIds)] };
  });

  return { list, total, page, limit };
}

function getOps(eventId, status) {
  return db
    .prepare(`SELECT * FROM giveaway_ops WHERE event_id = ? AND status = ? ORDER BY id ASC`)
    .all(eventId, status);
}

// Queue an op; the opposite pending op for the same delegate + giveaway cancels out
function queueOp(eventId, giveawayId, email, action) {
  const opposite = action === "assign" ? "revert" : "assign";
  const cancelled = db
    .prepare(
      `DELETE FROM giveaway_ops
       WHERE event_id = ? AND giveaway_id = ? AND email = ? AND action = ? AND status = 'pending'`,
    )
    .run(eventId, giveawayId, norm(email), opposite).changes;
  if (cancelled) return;
  db.prepare(
    `INSERT INTO giveaway_ops (event_id, giveaway_id, email, action, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(eventId, giveawayId, norm(email), action, new Date().toISOString());
}

/** Returns { giveaway } or { error: [status, message] } */
const assignGiveaway = db.transaction((eventId, giveawayId, email) => {
  const g = getGiveawayRow(eventId, giveawayId);
  if (!g) return { error: [404, "Giveaway not found"] };
  const reg = findRegistration(eventId, email);
  if (!reg) return { error: [404, "Delegate not found for this event"] };
  if (findAssignment(eventId, giveawayId, reg.email, reg.cloudId)) {
    return { error: [409, "Giveaway already assigned to this delegate"] };
  }
  if (toGiveaway(g).remainingQuantity <= 0) return { error: [400, "Giveaway out of stock"] };

  insertAssignment(eventId, giveawayId, reg.email, reg.cloudId, new Date().toISOString());
  queueOp(eventId, giveawayId, reg.email, "assign");
  return { giveaway: toGiveaway(g) };
});

const revertGiveaway = db.transaction((eventId, giveawayId, email) => {
  const g = getGiveawayRow(eventId, giveawayId);
  if (!g) return { error: [404, "Giveaway not found"] };
  const reg = findRegistration(eventId, email);
  if (!reg) return { error: [404, "Delegate not found for this event"] };
  if (!findAssignment(eventId, giveawayId, reg.email, reg.cloudId)) {
    return { error: [409, "This delegate doesn't have this giveaway"] };
  }

  deleteAssignment(eventId, giveawayId, reg.email, reg.cloudId);
  queueOp(eventId, giveawayId, reg.email, "revert");
  return { giveaway: toGiveaway(g) };
});

function removeOp(id) {
  db.prepare(`DELETE FROM giveaway_ops WHERE id = ?`).run(id);
}

function failOp(id, error) {
  db.prepare(`UPDATE giveaway_ops SET status = 'failed', error = ? WHERE id = ?`).run(error, id);
}

function clearFailedOps(eventId) {
  db.prepare(`DELETE FROM giveaway_ops WHERE event_id = ? AND status = 'failed'`).run(eventId);
}

/** pending = not pushed yet; waiting = delegate itself not on the cloud yet; failed = cloud rejected */
function getSyncStatus(eventId) {
  const pending = getOps(eventId, "pending");
  const waiting = pending.filter((op) => !findRegistration(eventId, op.email)?.cloudId).length;
  const failed = db
    .prepare(
      `SELECT o.id, o.action, o.email, o.error, o.created_at AS createdAt, g.title
       FROM giveaway_ops o
       LEFT JOIN giveaways g ON g.cloud_id = o.giveaway_id AND g.event_id = o.event_id
       WHERE o.event_id = ? AND o.status = 'failed' ORDER BY o.id DESC`,
    )
    .all(eventId);
  return { pending: pending.length, waiting, failed };
}

module.exports = {
  GIVEAWAY_ROLE_IDS,
  findRegistration,
  getGiveaways,
  replaceFromCloud,
  getAttendees,
  assignGiveaway,
  revertGiveaway,
  getOps,
  removeOp,
  failOp,
  clearFailedOps,
  getSyncStatus,
};
