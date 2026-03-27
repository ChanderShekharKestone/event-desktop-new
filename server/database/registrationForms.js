const { db } = require("../db");

function upsertRegistrationForms(forms) {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO registration_forms (
      cloud_id, event_id, attendee_type_name, type,
      is_registration_page_required, no_registration_email, no_email_for_event,
      page_section, is_enable_before, confirmation_pass_required,
      custom_fields, attendee_types, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const upsertMany = db.transaction((rows) => {
    for (const r of rows) {
      stmt.run(
        String(r._id),
        r.eventId ? String(r.eventId) : null,
        r.attendeeTypeName,
        r.type || "type1",
        r.isRegistrationPageRequired ? 1 : 0,
        r.noRegistrationEmail ? 1 : 0,
        r.noEmailForEvent ? 1 : 0,
        JSON.stringify(r.pageSection || []),
        r.isEnableBefore ? 1 : 0,
        r.confirmationPassRequired ? 1 : 0,
        JSON.stringify(r.customFields || []),
        JSON.stringify(r.attendeeTypes || []),
        r.createdAt || new Date().toISOString(),
        r.updatedAt || new Date().toISOString(),
      );
    }
  });

  upsertMany(forms);
}

function getRegistrationForms(eventId = null) {
  const where = eventId ? "WHERE event_id = ?" : "";
  const params = eventId ? [eventId] : [];
  return db
    .prepare(`SELECT * FROM registration_forms ${where} ORDER BY attendee_type_name ASC`)
    .all(params)
    .map(rowToObject);
}

function rowToObject(r) {
  return {
    _id: r.cloud_id,
    eventId: r.event_id,
    attendeeTypeName: r.attendee_type_name,
    type: r.type,
    isRegistrationPageRequired: Boolean(r.is_registration_page_required),
    noRegistrationEmail: Boolean(r.no_registration_email),
    noEmailForEvent: Boolean(r.no_email_for_event),
    pageSection: JSON.parse(r.page_section || "[]"),
    isEnableBefore: Boolean(r.is_enable_before),
    confirmationPassRequired: Boolean(r.confirmation_pass_required),
    customFields: JSON.parse(r.custom_fields || "[]"),
    attendeeTypes: JSON.parse(r.attendee_types || "[]"),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function getRegistrationFormByAttendeeType(attendeeTypeName, eventId = null) {
  const where = eventId
    ? "WHERE attendee_type_name = ? AND event_id = ?"
    : "WHERE attendee_type_name = ?";
  const params = eventId ? [attendeeTypeName, eventId] : [attendeeTypeName];
  const row = db.prepare(`SELECT * FROM registration_forms ${where} LIMIT 1`).get(...params);
  return row ? rowToObject(row) : null;
}

module.exports = { upsertRegistrationForms, getRegistrationForms, getRegistrationFormByAttendeeType };
