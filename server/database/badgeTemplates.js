const { db } = require("../db");

function upsertBadgeTemplates(templates) {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO badge_templates (cloud_id, event_id, name, type, width, height, bg_img, font_family, elements, alignment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const upsertMany = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        r._id,
        r.eventId,
        r.name,
        r.type,
        r.width || 320,
        r.height || 450,
        r.bgImg || "",
        r.fontFamily || "Arial",
        JSON.stringify(r.elements || []),
        r.alignment || "center",
        r.createdAt,
        r.updatedAt
      );
    }
  });

  upsertMany(templates);
}

function getBadgeTemplates(eventId = null) {
  const where = eventId ? "WHERE event_id = ?" : "";
  const params = eventId ? [eventId] : [];
  return db.prepare(`SELECT * FROM badge_templates ${where} ORDER BY name ASC`).all(params).map((r) => ({
    _id: r.cloud_id,
    name: r.name,
    type: r.type,
    width: r.width,
    height: r.height,
    bgImg: r.bg_img,
    fontFamily: r.font_family,
    elements: JSON.parse(r.elements || "[]"),
    alignment: r.alignment || "center",
    eventId: r.event_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

module.exports = { upsertBadgeTemplates, getBadgeTemplates };
