const { db } = require("../db");

function upsertAttendeeTypes(types) {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO attendee_types (cloud_id, event_id, name, display_name, is_active, can_be_deleted, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const upsertMany = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        r._id,
        r.eventId,
        r.name,
        r.displayName,
        r.isActive ? 1 : 0,
        r.canBeDeleted ? 1 : 0,
        r.createdAt,
        r.updatedAt
      );
    }
  });

  upsertMany(types);
}

function getAttendeeTypes(eventId = null) {
  const where = eventId ? "WHERE is_active = 1 AND event_id = ?" : "WHERE is_active = 1";
  const params = eventId ? [eventId] : [];
  return db.prepare(`SELECT * FROM attendee_types ${where} ORDER BY display_name ASC`).all(params).map((r) => ({
    _id: r.cloud_id,
    name: r.name,
    displayName: r.display_name,
    isActive: Boolean(r.is_active),
    canBeDeleted: Boolean(r.can_be_deleted),
    eventId: r.event_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

module.exports = { upsertAttendeeTypes, getAttendeeTypes };
