const { db } = require("../db");

const parseJson = (s) => {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};

// Mirror cloud: replace all rows for this event so cloud deletions are removed locally.
function replaceBadgeTemplates(eventId, templates) {
  const del = db.prepare(`DELETE FROM badge_templates WHERE event_id = ?`);
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO badge_templates (cloud_id, event_id, name, type, width, height, bg_img, font_family, elements, alignment, created_at, updated_at,
       print_settings, lanyard_img, lanyard_color, lanyard_color_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const replaceAll = db.transaction((rows) => {
    del.run(eventId);
    for (const r of rows) {
      stmt.run(
        r._id,
        eventId,
        r.name,
        r.type,
        r.width || 320,
        r.height || 450,
        r.bgImg || "",
        r.fontFamily || "Arial",
        JSON.stringify(r.elements || []),
        r.alignment || "center",
        r.createdAt,
        r.updatedAt,
        r.printSettings ? JSON.stringify(r.printSettings) : null,
        r.lanyardImg || null,
        r.lanyardColor || null,
        r.lanyardColorName || null
      );
    }
  });

  replaceAll(templates);
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
    printSettings: parseJson(r.print_settings),
    lanyardImg: r.lanyard_img || null,
    lanyardColor: r.lanyard_color || null,
    lanyardColorName: r.lanyard_color_name || null,
    eventId: r.event_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

module.exports = { replaceBadgeTemplates, getBadgeTemplates };
