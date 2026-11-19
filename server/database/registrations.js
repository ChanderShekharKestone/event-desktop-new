const { db } = require("../db");
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

  const localId = result.lastInsertRowid;
  const user = rowToObject({
    ...result,
    id: localId,
    timestamp,
    ...data,
  });
  addPending(localId, user.eventId || "");
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
    uniqueUserId: r.uniqueUserId ?? null,
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
    areaOfInterest: (() => { try { return JSON.parse(r.areaOfInterest || "[]"); } catch { return []; } })(),
    customfields: (() => { try { return r.customfields ? JSON.parse(r.customfields) : null; } catch { return null; } })(),
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
  type = "",
  isCheckedIn = "",
  campaignSource = "",
  isPrintClicked = "",
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

  if (type) {
    conditions.push("type = ?");
    params.push(type);
  }

  if (isCheckedIn !== "") {
    conditions.push("isCheckedIn = ?");
    params.push(isCheckedIn === "1" ? 1 : 0);
  }

  if (campaignSource) {
    if (campaignSource === "__direct__") {
      conditions.push("(campaignSource IS NULL OR campaignSource = '')");
    } else {
      conditions.push("campaignSource = ?");
      params.push(campaignSource);
    }
  }

  if (isPrintClicked !== "") {
    conditions.push("isPrintClicked = ?");
    params.push(isPrintClicked === "1" ? 1 : 0);
  }

  if (search.trim()) {
    const tokens = search.trim().split(/\s+/);
    const clauses = tokens.map(
      () =>
        `(firstName LIKE ? OR lastName LIKE ? OR email LIKE ? OR mobile LIKE ? OR organization LIKE ? OR designation LIKE ? OR uniqueUserId LIKE ?)`,
    );
    conditions.push(`(${clauses.join(" AND ")})`);
    params.push(...tokens.flatMap((t) => Array(7).fill(`%${t}%`)));
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
  if (row?.id) addPending(row.id, row.eventId || '');
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
  if (row?.id) addPending(row.id, row.eventId || '');
  return row ? rowToObject(row) : null;
}

// uniqueUserId formats in use: "YZ_1234" (in-person sequence), "GAI-00001",
// "ABCD-EFGH-IJKL-MNOP" (random) — letters, digits, dashes, underscores
const UNIQUE_ID = /^[A-Z0-9][A-Z0-9_-]{0,63}$/i;
const CLOUD_ID = /^[a-f0-9]{24}$/i;

/**
 * Which registration a badge value points to. Accepts:
 *   - a number: local id (Delegates page "mark present")
 *   - '{"id": …}': older badges; id is the cloud _id, or the local id for a
 *     walk-in not pushed yet
 *   - a 24-hex string: cloud _id (new badge for a delegate with no uniqueUserId)
 *   - anything else letter/digit/dash: uniqueUserId (new cloud badges)
 * Returns { row } or { error: [status, message] }.
 */
function findBadgeRow(value, eventId) {
  const eventFilter = eventId ? " AND eventId=?" : "";
  const ev = eventId ? [eventId] : [];
  const one = (where, ...args) =>
    db.prepare(`SELECT * FROM registrations WHERE ${where}${eventFilter}`).get(...args, ...ev);
  const byCloudId = (id) => one("LOWER(cloudId)=?", String(id).toLowerCase());
  const byLocalId = (id) => one("id=?", Number(id));
  const notFound = { error: [404, "QR code not recognized, please visit the help desk"] };

  if (typeof value === "number") {
    const row = byLocalId(value);
    return row ? { row } : notFound;
  }
  if (typeof value !== "string" || !value.trim()) return { error: [400, "Invalid QR code"] };
  const text = value.trim();

  if (text.startsWith("{")) {
    let id;
    try {
      id = JSON.parse(text)?.id;
    } catch {
      return { error: [400, "Invalid QR code"] };
    }
    if (id === undefined || id === null || id === "") return { error: [400, "Invalid QR code"] };
    // Only a whole number is a local id — parseInt("69bc…") would be 69, someone else
    const row = byCloudId(id) || (/^\d+$/.test(String(id)) ? byLocalId(id) : undefined);
    return row ? { row } : notFound;
  }

  if (CLOUD_ID.test(text)) {
    const row = byCloudId(text);
    if (row) return { row };
  }
  if (!UNIQUE_ID.test(text)) return { error: [400, "Invalid QR code"] };

  const rows = db
    .prepare(`SELECT * FROM registrations WHERE uniqueUserId=?${eventFilter} LIMIT 2`)
    .all(text.toUpperCase(), ...ev);
  if (rows.length > 1) {
    return { error: [409, "This QR code matches more than one delegate, please visit the help desk"] };
  }
  return rows.length ? { row: rows[0] } : notFound;
}

// Same messages as the cloud (api/controllers/scan.controller.js) — the scan page
// turns the first into its "Print again?" dialog instead of an error toast
const ALREADY_SCANNED_MESSAGE = "This QR code has already been scanned, please visit the help desk";
const ALREADY_CHECKED_IN_MESSAGE = "This delegate has already been checked in, please visit the help desk";

/**
 * Check in + mark printed. Already checked in → 409 unless allowReprint (set by the
 * "Print again?" confirm and the search list's Print button). A re-print keeps the
 * first check-in time, and isPrintClicked never goes back from 1 to 0.
 */
function markCheckedIn(row, { checkedInTime, isPrintClicked, allowReprint }, alreadyMessage) {
  if (row.isCheckedIn && !allowReprint) return { error: [409, alreadyMessage] };
  db.prepare(
    `UPDATE registrations
     SET isCheckedIn = 1, attend = 1,
         checkedInTime = COALESCE(checkedInTime, ?),
         isPrintClicked = MAX(COALESCE(isPrintClicked, 0), ?)
     WHERE id = ?`,
  ).run(checkedInTime || new Date().toISOString(), isPrintClicked ? 1 : 0, row.id);
  const updated = db.prepare(`SELECT * FROM registrations WHERE id = ?`).get(row.id);
  queueCheckin(updated);
  return { row: updated };
}

function checkinById(value, { checkedInTime, isPrintClicked, allowReprint = false, eventId = null }) {
  const found = findBadgeRow(value, eventId);
  if (found.error) return found;
  return markCheckedIn(found.row, { checkedInTime, isPrintClicked, allowReprint }, ALREADY_SCANNED_MESSAGE);
}

function checkinByEmail(email, { checkedInTime, isPrintClicked, allowReprint = false, eventId = null }) {
  const norm = typeof email === "string" ? email.toLowerCase().trim() : "";
  if (!norm) return { error: [400, "Email is required"] };
  const eventFilter = eventId ? " AND eventId=?" : "";
  const row = db
    .prepare(`SELECT * FROM registrations WHERE LOWER(email)=?${eventFilter}`)
    .get(norm, ...(eventId ? [eventId] : []));
  if (!row) return { error: [404, "Please enter a valid email address"] };
  return markCheckedIn(row, { checkedInTime, isPrintClicked, allowReprint }, ALREADY_CHECKED_IN_MESSAGE);
}

// Masked like the cloud (api/utils/mask.js): the search also runs on LAN kiosk
// screens, where any attendee could list other attendees
function maskEmail(email) {
  if (typeof email !== "string" || !email.includes("@")) return email ? "****" : email;
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const masked =
    local.length > 5
      ? local.slice(0, 3) + "*".repeat(local.length - 5) + local.slice(-2)
      : local.length > 1
        ? local[0] + "*".repeat(local.length - 1)
        : "*".repeat(local.length);
  return `${masked}@${email.slice(at + 1)}`;
}

function maskMobile(mobile) {
  if (mobile === undefined || mobile === null || mobile === "") return mobile;
  const digits = String(mobile).replace(/\D/g, "");
  if (digits.length <= 5) return "*".repeat(digits.length);
  return digits.slice(0, 3) + "*".repeat(digits.length - 5) + digits.slice(-2);
}

const SCAN_SEARCH_FIELDS = ["firstName", "lastName", "email", "organization", "designation", "type", "mobile", "uniqueUserId"];

/**
 * Scan page "Search manually": every word must match one of SCAN_SEARCH_FIELDS,
 * so "priya infosys" finds Priya at Infosys. Read-only; email / mobile masked.
 */
function searchDelegates(eventId, q, limit = 10) {
  const tokens = String(q || "").trim().split(/\s+/).filter(Boolean);
  if (tokens.join(" ").length < 2) return [];
  const conditions = [];
  const params = [];
  if (eventId) {
    conditions.push("eventId = ?");
    params.push(eventId);
  }
  for (const t of tokens) {
    conditions.push(`(${SCAN_SEARCH_FIELDS.map((f) => `${f} LIKE ? ESCAPE '\\'`).join(" OR ")})`);
    const like = `%${t.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    params.push(...SCAN_SEARCH_FIELDS.map(() => like));
  }
  return db
    .prepare(
      `SELECT id, firstName, lastName, email, mobile, organization, designation, type,
              isCheckedIn, isPrintClicked, avatarUrl
       FROM registrations WHERE ${conditions.join(" AND ")}
       ORDER BY firstName COLLATE NOCASE, lastName COLLATE NOCASE LIMIT ?`,
    )
    .all(...params, Math.min(25, Math.max(1, limit)))
    .map((r) => ({
      _id: r.id,
      firstName: r.firstName ?? "",
      lastName: r.lastName ?? "",
      email: maskEmail(r.email),
      mobile: maskMobile(r.mobile),
      organization: r.organization ?? "",
      designation: r.designation ?? "",
      type: r.type ?? "",
      isCheckedIn: Boolean(r.isCheckedIn),
      isPrintClicked: Boolean(r.isPrintClicked),
      avatarUrl: r.avatarUrl ?? null,
    }));
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
  searchDelegates,
  rowToObject,
  updateCloudId,
};
