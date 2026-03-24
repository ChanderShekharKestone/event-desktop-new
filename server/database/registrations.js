const { db } = require("../db");
const { addToQueue } = require("./syncQueue");
const { addPending } = require("./pushPending");

function insertRegistration(data) {
  const timestamp = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO registrations (
        cloudId, customerId, firstName, lastName, email, mobile,
        organization, designation, avatarUrl, roleId, eventId,
        campaignSource, amount, paymentStatus, type, appType,
        isCheckedIn, checkedInTime, isActive, isLoginAllowed,
        moderator, attend, primeMember, termsAndCondn, isPrintClicked,
        areaOfInterest, customfields, timestamp
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
    )
    .run(
      data.cloudId ?? data.cloud_id ?? null,
      data.customerId ?? data.customer_id ?? null,
      data.firstName ?? data.first_name ?? "",
      data.lastName ?? data.last_name ?? "",
      data.email,
      data.mobile ?? "",
      data.organization ?? "",
      data.designation ?? "",
      data.avatarUrl ?? data.avatar_url ?? "https://cdn.vosmos.live/VEP/assests/dummy.png",
      data.roleId ?? data.role_id ?? null,
      data.eventId ?? data.event_id ?? null,
      data.campaignSource ?? data.campaign_source ?? null,
      data.amount ?? 0,
      data.paymentStatus ?? data.payment_status ?? "Pending",
      data.type ?? "attendee",
      data.appType ?? data.app_type ?? null,
      data.isCheckedIn ?? data.is_checked_in ?? 0,
      data.checkedInTime ?? data.checked_in_time ?? null,
      data.isActive ?? data.is_active ?? 1,
      data.isLoginAllowed ?? data.is_login_allowed ?? 0,
      data.moderator ?? 0,
      data.attend ?? 0,
      data.primeMember ?? data.prime_member ?? 0,
      data.termsAndCondn ?? data.terms_and_condn ?? 0,
      data.isPrintClicked ?? data.is_print_clicked ?? 0,
      JSON.stringify(data.areaOfInterest ?? data.area_of_interest ?? []),
      data.customfields ? JSON.stringify(data.customfields) : null,
      timestamp,
    );

  const user = rowToObject({
    ...result,
    id: result.lastInsertRowid,
    timestamp,
    ...data,
  });
  addToQueue("create_registration", user);
  return user;
}

function getRegistrations() {
  const rows = db.prepare("SELECT * FROM registrations ORDER BY id DESC").all();
  return rows.map(rowToObject);
}

function rowToObject(r) {
  return {
    _id: r.id,
    cloudId: r.cloudId ?? null,
    customerId: r.customerId ?? null,
    firstName: r.firstName ?? "",
    lastName: r.lastName ?? "",
    email: r.email,
    mobile: r.mobile ?? "",
    organization: r.organization ?? "",
    designation: r.designation ?? "",
    avatarUrl: r.avatarUrl ?? "https://cdn.vosmos.live/VEP/assests/dummy.png",
    roleId: r.roleId ?? null,
    eventId: r.eventId ?? null,
    campaignSource: r.campaignSource ?? null,
    amount: r.amount ?? 0,
    paymentStatus: r.paymentStatus ?? "Pending",
    type: r.type ?? "attendee",
    appType: r.appType ?? null,
    isCheckedIn: Boolean(r.isCheckedIn),
    checkedInTime: r.checkedInTime ?? null,
    isActive: Boolean(r.isActive ?? 1),
    isLoginAllowed: Boolean(r.isLoginAllowed),
    moderator: Boolean(r.moderator),
    attend: Boolean(r.attend),
    primeMember: Boolean(r.primeMember),
    termsAndCondn: Boolean(r.termsAndCondn),
    isPrintClicked: Boolean(r.isPrintClicked),
    areaOfInterest: JSON.parse(r.areaOfInterest ?? "[]"),
    customfields: r.customfields ? JSON.parse(r.customfields) : null,
    createdAt: r.timestamp,
    updatedAt: r.timestamp,
  };
}

function getRegistrationsPaginated({
  page = 1,
  limit = 25,
  search = "",
  sort = "timestamp",
  order = "desc",
  eventId = null,
}) {
  const columnMap = {
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
    mobile: "mobile",
    organization: "organization",
    designation: "designation",
    paymentStatus: "paymentStatus",
    isCheckedIn: "isCheckedIn",
    createdAt: "timestamp",
  };

  const sortCol = columnMap[sort] || "timestamp";
  const sortDir = order === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const conditions = [];
  let params = [];

  if (eventId) {
    conditions.push("eventId = ?");
    params.push(eventId);
  }

  if (search.trim()) {
    const tokens = search.trim().split(/\s+/);
    const clauses = tokens.map(
      () =>
        `(firstName LIKE ? OR lastName LIKE ? OR email LIKE ? OR mobile LIKE ? OR organization LIKE ? OR designation LIKE ?)`,
    );
    conditions.push(`(${clauses.join(" AND ")})`);
    params.push(...tokens.flatMap((t) => Array(6).fill(`%${t}%`)));
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM registrations ${where}`)
    .get(params).count;

  const rows = db
    .prepare(
      `SELECT * FROM registrations ${where} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
    )
    .all([...params, limit, offset]);

  return { data: rows.map(rowToObject), total };
}

function queueCheckin(row) {
  if (row?.id) addPending(row.id);
}

function updateRegistration(idValue, data) {
  const fields = [];
  const values = [];

  const colMap = {
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
    mobile: "mobile",
    organization: "organization",
    designation: "designation",
    avatarUrl: "avatarUrl",
    roleId: "roleId",
    eventId: "eventId",
    amount: "amount",
    paymentStatus: "paymentStatus",
    type: "type",
    isActive: "isActive",
    isLoginAllowed: "isLoginAllowed",
    moderator: "moderator",
    attend: "attend",
    primeMember: "primeMember",
    termsAndCondn: "termsAndCondn",
    areaOfInterest: "areaOfInterest",
    isPrintClicked: "isPrintClicked",
  };

  const boolFields = new Set(["isActive", "isLoginAllowed", "moderator", "attend", "primeMember", "termsAndCondn", "isPrintClicked"]);

  for (const [key, col] of Object.entries(colMap)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = ?`);
      let val = data[key];
      if (boolFields.has(key)) val = val ? 1 : 0;
      else if (key === "areaOfInterest") val = JSON.stringify(val);
      values.push(val);
    }
  }

  if (!fields.length) return null;

  values.push(idValue);
  db.prepare(`UPDATE registrations SET ${fields.join(", ")} WHERE id = ?`).run(
    ...values,
  );

  const row = db
    .prepare("SELECT * FROM registrations WHERE id = ?")
    .get(idValue);
  if (row?.id) addPending(row.id);
  return row ? rowToObject(row) : null;
}

function checkinById(idValue, { checkedInTime, isPrintClicked, eventId = null }) {
  const params = [checkedInTime, isPrintClicked ? 1 : 0];
  const eventFilter = eventId ? " AND eventId=?" : "";
  const eventParams = eventId ? [eventId] : [];

  // Try cloudId first (QR from cloud/synced user contains MongoDB _id)
  db.prepare(
    `UPDATE registrations SET isCheckedIn=1, checkedInTime=?, isPrintClicked=? WHERE cloudId=?${eventFilter}`,
  ).run(...params, idValue, ...eventParams);
  const byCloudId = db
    .prepare(`SELECT * FROM registrations WHERE cloudId=?${eventFilter}`)
    .get(idValue, ...eventParams);
  if (byCloudId) {
    queueCheckin(byCloudId);
    return byCloudId;
  }

  // Fallback: local offline user — look up by SQLite id (integer)
  const localId = parseInt(idValue, 10);
  if (!isNaN(localId)) {
    db.prepare(
      `UPDATE registrations SET isCheckedIn=1, checkedInTime=?, isPrintClicked=? WHERE id=?${eventFilter}`,
    ).run(...params, localId, ...eventParams);
    const row =
      db.prepare(`SELECT * FROM registrations WHERE id=?${eventFilter}`).get(localId, ...eventParams) ?? null;
    queueCheckin(row);
    return row;
  }

  return null;
}

function checkinByEmail(email, { checkedInTime, isPrintClicked, eventId = null }) {
  const norm = email.toLowerCase().trim();
  const eventFilter = eventId ? " AND eventId=?" : "";
  const eventParams = eventId ? [eventId] : [];
  db.prepare(
    `UPDATE registrations SET isCheckedIn=1, checkedInTime=?, isPrintClicked=? WHERE LOWER(email)=?${eventFilter}`,
  ).run(checkedInTime, isPrintClicked ? 1 : 0, norm, ...eventParams);
  const row =
    db.prepare(`SELECT * FROM registrations WHERE LOWER(email)=?${eventFilter}`).get(norm, ...eventParams) ?? null;
  queueCheckin(row);
  return row;
}

function updateCloudId(localId, cloudId) {
  db.prepare(`UPDATE registrations SET cloudId = ? WHERE id = ?`).run(cloudId, localId);
}

module.exports = {
  insertRegistration,
  updateRegistration,
  getRegistrations,
  getRegistrationsPaginated,
  checkinById,
  checkinByEmail,
  rowToObject,
  updateCloudId,
};
