const { db } = require("../db");

// Wrap entire batch in one transaction — avoids per-row lock contention
// Prepared lazily (not at require time) so the table exists when first called
function insertManyFromCloud(users) {
  const upsert = db.prepare(
    `INSERT INTO registrations (
       cloudId, firstName, lastName, email, mobile, organization, designation,
       isCheckedIn, checkedInTime, isPrintClicked, isActive, isLoginAllowed,
       roleId, eventId, amount, paymentStatus, type, primeMember, moderator,
       attend, termsAndCondn, areaOfInterest, timestamp
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cloudId) DO UPDATE SET
       firstName      = excluded.firstName,
       lastName       = excluded.lastName,
       email          = excluded.email,
       mobile         = excluded.mobile,
       organization   = excluded.organization,
       designation    = excluded.designation,
       isCheckedIn    = excluded.isCheckedIn,
       checkedInTime  = excluded.checkedInTime,
       isPrintClicked = excluded.isPrintClicked,
       isActive       = excluded.isActive,
       isLoginAllowed = excluded.isLoginAllowed,
       roleId         = excluded.roleId,
       eventId        = excluded.eventId,
       amount         = excluded.amount,
       paymentStatus  = excluded.paymentStatus,
       type           = excluded.type,
       primeMember    = excluded.primeMember,
       moderator      = excluded.moderator,
       attend         = excluded.attend,
       termsAndCondn  = excluded.termsAndCondn,
       areaOfInterest = excluded.areaOfInterest,
       timestamp      = excluded.timestamp`,
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
      );
    }
  });
  runAll(users);
}

module.exports = { insertManyFromCloud };
