const { db } = require("../db");

function getFormHeadings(eventId) {
  return db
    .prepare("SELECT * FROM form_headings WHERE event_id = ?")
    .all(eventId || "")
    .map(rowToObject);
}

function getFormHeading(eventId, type) {
  const row = db
    .prepare("SELECT * FROM form_headings WHERE event_id = ? AND type = ?")
    .get(eventId || "", type);
  return row ? rowToObject(row) : null;
}

function upsertFormHeading(eventId, type, { heading, subheading, cssUrls }) {
  db.prepare(
    `INSERT INTO form_headings (event_id, type, heading, subheading, css_urls, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_id, type) DO UPDATE SET
       heading = excluded.heading,
       subheading = excluded.subheading,
       css_urls = excluded.css_urls,
       updated_at = excluded.updated_at`,
  ).run(eventId || "", type, heading || "", subheading || "", JSON.stringify(cssUrls || []), new Date().toISOString());
  return getFormHeading(eventId, type);
}

function parseUrls(json) {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function rowToObject(r) {
  return {
    type: r.type,
    heading: r.heading,
    subheading: r.subheading,
    cssUrls: parseUrls(r.css_urls),
    updatedAt: r.updated_at,
  };
}

module.exports = { getFormHeadings, getFormHeading, upsertFormHeading };
