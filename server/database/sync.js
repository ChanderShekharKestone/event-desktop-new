const { db } = require("../db");

// Badge QR value; the cloud has many "" — store those as NULL
const toUniqueUserId = (v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : null);

const DEFAULT_AVATAR = "https://cdn.vosmos.live/VEP/assests/dummy.png";

// Fields the desktop never edits but pushes back with every check-in (pushSync sends
// the whole row): they must hold the cloud's values or the PUT blanks them on the cloud
const extraFields = (u) => [
  u.avatarUrl || DEFAULT_AVATAR,
  u.customfields && typeof u.customfields === "object" ? JSON.stringify(u.customfields) : null,
  u.campaignSource ?? null,
  u.customerId ? String(u.customerId) : null,
  u.appType ?? null,
];

// Wrap entire batch in one transaction — avoids per-row lock contention
// Prepared lazily (not at require time) so the table exists when first called
function insertManyFromCloud(users) {
  const upsert = db.prepare(
    `INSERT OR REPLACE INTO registrations (
       cloudId, firstName, lastName, email, mobile, organization, designation,
       isCheckedIn, checkedInTime, isPrintClicked, isActive, isLoginAllowed,
       roleId, eventId, amount, paymentStatus, type, primeMember, moderator,
       attend, termsAndCondn, areaOfInterest, timestamp, uniqueUserId,
       avatarUrl, customfields, campaignSource, customerId, appType
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const runAll = db.transaction((rows) => {
    for (const user of rows) {
      upsert.run(
        user._id,
        user.firstName ?? "",
        user.lastName ?? "",
        user.email,
        user.mobile ?? "",
        user.organization ?? "",
        user.designation ?? "",
        user.isCheckedIn ? 1 : 0,
        user.checkedInTime ?? null,
        user.isPrintClicked ? 1 : 0,
        user.isActive !== false ? 1 : 0,
        user.isLoginAllowed ? 1 : 0,
        user.roleId ?? null,
        user.eventId ?? null,
        user.amount ?? 0,
        user.paymentStatus ?? "Pending",
        user.type ?? "attendee",
        user.primeMember ? 1 : 0,
        user.moderator ? 1 : 0,
        user.attend ? 1 : 0,
        user.termsAndCondn ? 1 : 0,
        JSON.stringify(user.areaOfInterest ?? []),
        user.updatedAt,
        toUniqueUserId(user.uniqueUserId),
        ...extraFields(user),
      );
    }
  });
  runAll(users);
}

/**
 * Fill in uniqueUserId + the extra fields for rows pulled before those columns were
 * stored, touching no other column (no INSERT OR REPLACE: that changes local ids)
 */
function setPulledExtras(eventId, users) {
  const update = db.prepare(
    `UPDATE registrations
     SET uniqueUserId = ?, avatarUrl = ?, customfields = ?, campaignSource = ?, customerId = ?, appType = ?
     WHERE cloudId = ? AND eventId = ?`,
  );
  db.transaction(() => {
    for (const u of users) {
      update.run(toUniqueUserId(u.uniqueUserId), ...extraFields(u), String(u._id), eventId);
    }
  })();
}

module.exports = { insertManyFromCloud, setPulledExtras, toUniqueUserId };
