/**
 * Lead capture — booths and rooms. Ported from the diy-ui api
 * (controllers/leadCapture.controller.js) to SQLite; same rules, same response shapes,
 * so the client pages port with path changes only.
 *
 * Booth: every scan is a visit (inTime only) + one booth lead per attendee for rating/note.
 * Room:  "smart" scanning by default — a scan marks them IN, or OUT if already in this room
 *        (after the volunteer confirms); in another room, the volunteer confirms the move.
 *        "entry" / "exit" are for separate doors. Out times are only ever a real scan or an
 *        admin check-out; with no exit scan the out time stays empty and they count as present
 *        until the room's agenda ends that day.
 *
 * Desktop differences:
 *  - Attendees are registrations of this PC, keyed by lowercase email (see migrations).
 *  - Scanner links are served on the LAN by this PC (see routes/leadPublic.js).
 *  - Functions return { data } / { error: [status, message] } instead of writing responses.
 *  - better-sqlite3 is synchronous, so each scan runs in one transaction: no races.
 */
const crypto = require("crypto");
const { db } = require("../db");
const { findBadgeRow } = require("./registrations");
const { dayBounds, eventTimeZone } = require("../utils/leadTime");
const { sessionWindow } = require("../utils/attendance");
const { toScreenSettings, readScreenSettings } = require("../utils/screenSettings");

const LINK_VALIDITY_MS = 10 * 24 * 60 * 60 * 1000; // 10 days, same as the kiosk
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000; // booth: same badge again within 2 min = accidental double scan
const ROOM_DUPLICATE_MS = 30 * 1000; // room: same badge at the same room within 30 s = double beep
const ROOM_MODES = ["smart", "entry", "exit"];
const MISTAKE_WINDOW_MS = 2 * 60 * 1000; // a session switched away from within 2 min was a mis-tap
const RATINGS = ["hot", "warm", "cold"];
const INVALID_LINK = "This scanner link is invalid or has expired. Please ask the event team for a new one.";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Mongo ObjectId layout (4-byte seconds, 5 random bytes, 3-byte counter) so records made
// here can keep their id as _id on the cloud
const PROCESS_RANDOM = crypto.randomBytes(5).toString("hex");
let idCounter = crypto.randomBytes(3).readUIntBE(0, 3);
const newId = () => {
  idCounter = (idCounter + 1) % 0x1000000;
  return (
    Math.floor(Date.now() / 1000).toString(16).padStart(8, "0") +
    PROCESS_RANDOM +
    idCounter.toString(16).padStart(6, "0")
  );
};
const isId = (v) => typeof v === "string" && /^[a-f0-9]{24}$/.test(v);
const newToken = () => crypto.randomBytes(24).toString("base64url");
const iso = (v) => new Date(v).toISOString();
const ms = (v) => (v ? new Date(v).getTime() : null);
const err = (status, message) => ({ error: [status, message] });

const toDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const parseJson = (s, fallback) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};

const inList = (ids) => ids.map(() => "?").join(", ") || "NULL";

function addTombstone(kind, id, eventId) {
  db.prepare(
    `INSERT OR REPLACE INTO lead_tombstones (kind, id, event_id, deleted_at) VALUES (?, ?, ?, ?)`,
  ).run(kind, id, eventId, iso(Date.now()));
}

// ─── Row shapes ───────────────────────────────────────────────────────────────

const rowToPoint = (r) =>
  r && {
    _id: r.id,
    eventId: r.event_id,
    name: r.name,
    type: r.type,
    exhibitorName: r.exhibitor_name || "",
    capacity: r.capacity ?? null,
    scanToken: r.scan_token,
    tokenExpiresAt: r.token_expires_at,
    screen: parseJson(r.screen, {}),
    createdAt: r.created_at,
  };

const linkLive = (p) => p.scanToken && ms(p.tokenExpiresAt) > Date.now();

// Client shape — the token is only included for admins (they build the link from it)
const toPoint = (p, extra = {}) => ({
  _id: p._id,
  name: p.name,
  type: p.type,
  exhibitorName: p.exhibitorName,
  capacity: p.capacity,
  scanToken: linkLive(p) ? p.scanToken : null,
  tokenExpiresAt: linkLive(p) ? p.tokenExpiresAt : null,
  createdAt: p.createdAt,
  ...extra,
});

const rowToSession = (r) => ({
  _id: r.id,
  roomId: r.room_id,
  title: r.title,
  speaker: r.speaker || "",
  startTime: r.start_time,
  endTime: r.end_time,
  actualStartTime: r.actual_start_time || null,
  actualEndTime: r.actual_end_time || null,
});

const toSession = ({ roomId, ...s }) => s;

const rowToVisit = (r) => ({
  _id: r.id,
  pointId: r.point_id,
  attendeeEmail: r.attendee_email,
  attendeeCloudId: r.attendee_cloud_id,
  type: r.type,
  inTime: new Date(r.in_time),
  outTime: r.out_time ? new Date(r.out_time) : null,
  status: r.status,
  outReason: r.out_reason,
  autoCloseAt: r.auto_close_at ? new Date(r.auto_close_at) : null,
});

/** Grouping key for an attendee: email, or the cloud id for cloud visits with no local registration */
const attendeeKey = (v) => v.attendeeEmail || (v.attendeeCloudId ? `cloud:${v.attendeeCloudId}` : "unknown");

// "Priya S." — what the scanner screen shows; no email/phone
const displayName = (a) =>
  [a.firstName, a.lastName ? `${a.lastName.trim()[0]}.` : ""].filter(Boolean).join(" ");

const getPointRow = (eventId, id) =>
  isId(id) ? rowToPoint(db.prepare(`SELECT * FROM lead_points WHERE id = ? AND event_id = ?`).get(id, eventId)) : null;

const agendaOf = (roomId) =>
  db
    .prepare(`SELECT * FROM lead_sessions WHERE room_id = ? ORDER BY start_time ASC`)
    .all(roomId)
    .map(rowToSession)
    .map(toSession);

// ─── Room housekeeping (run lazily before reading "in" counts) ────────────────

/**
 * Until when a room visit with no exit scan counts as present: the end of the room's last
 * session that day (as it actually ran), or midnight (event time zone) when the room has no
 * agenda that day or it is already over.
 */
function autoCloseFor(roomId, inTimeMs, timeZone) {
  const { start, end } = dayBounds(inTimeMs, timeZone);
  const sessions = db
    .prepare(`SELECT * FROM lead_sessions WHERE room_id = ? AND start_time >= ? AND start_time < ?`)
    .all(roomId, iso(start), iso(end))
    .map(rowToSession);
  const lastEnd = sessions.length ? Math.max(...sessions.map((s) => sessionWindow(s).end)) : 0;
  return lastEnd > inTimeMs ? new Date(lastEnd) : end;
}

/** Sessions still "running" after their day is over end after their scheduled length */
function endStaleSessions(eventId) {
  const running = db
    .prepare(
      `SELECT * FROM lead_sessions WHERE event_id = ? AND actual_start_time IS NOT NULL AND actual_end_time IS NULL`,
    )
    .all(eventId)
    .map(rowToSession);
  if (!running.length) return;
  const timeZone = eventTimeZone();
  const now = Date.now();
  const update = db.prepare(
    `UPDATE lead_sessions SET actual_end_time = ?, updated_at = ?, sync_state = 'dirty'
     WHERE id = ? AND actual_end_time IS NULL`,
  );
  for (const s of running) {
    if (dayBounds(s.actualStartTime, timeZone).end.getTime() <= now) {
      update.run(iso(sessionWindow(s).end), iso(now), s._id);
    }
  }
}

/** Close open room visits whose day is over (no out time — "no-exit-scan") */
function closeStaleVisits(eventId) {
  endStaleSessions(eventId);
  const now = iso(Date.now());
  db.prepare(
    `UPDATE lead_visits SET status = 'out', out_reason = 'no-exit-scan', updated_at = ?, sync_state = 'dirty'
     WHERE event_id = ? AND status = 'in' AND auto_close_at IS NOT NULL AND auto_close_at <= ?`,
  ).run(now, eventId, now);
}

/** After an agenda change: recompute when the room's open visits close by themselves */
function refreshAutoClose(room) {
  const open = db.prepare(`SELECT id, in_time FROM lead_visits WHERE point_id = ? AND status = 'in'`).all(room._id);
  if (open.length) {
    const timeZone = eventTimeZone();
    const update = db.prepare(
      `UPDATE lead_visits SET auto_close_at = ?, updated_at = ?, sync_state = 'dirty' WHERE id = ? AND status = 'in'`,
    );
    for (const v of open) update.run(iso(autoCloseFor(room._id, ms(v.in_time), timeZone)), iso(Date.now()), v.id);
  }
  closeStaleVisits(room.eventId);
}

const runningSession = (agenda) => agenda.find((s) => s.actualStartTime && !s.actualEndTime) || null;

function liveCounts(pointIds) {
  if (!pointIds.length) return new Map();
  const rows = db
    .prepare(
      `SELECT point_id, COUNT(*) AS c FROM lead_visits
       WHERE status = 'in' AND point_id IN (${inList(pointIds)}) GROUP BY point_id`,
    )
    .all(...pointIds);
  return new Map(rows.map((r) => [r.point_id, r.c]));
}

/**
 * Points in the admin's shape: link + scan counts, plus liveCount and agenda (room) or
 * rating totals (booth).
 */
function withStats(points) {
  const ids = points.map((p) => p._id);
  if (!ids.length) return [];
  const live = liveCounts(ids);
  const visits = new Map(
    db
      .prepare(
        `SELECT point_id, COUNT(*) AS total,
                COUNT(DISTINCT COALESCE(attendee_email, attendee_cloud_id)) AS uniq
         FROM lead_visits WHERE point_id IN (${inList(ids)}) GROUP BY point_id`,
      )
      .all(...ids)
      .map((r) => [r.point_id, r]),
  );
  const ratingsById = new Map();
  for (const r of db
    .prepare(
      `SELECT point_id, rating, COUNT(*) AS c FROM lead_booth_leads
       WHERE point_id IN (${inList(ids)}) AND rating IS NOT NULL GROUP BY point_id, rating`,
    )
    .all(...ids)) {
    ratingsById.set(r.point_id, { ...ratingsById.get(r.point_id), [r.rating]: r.c });
  }
  const agendaById = new Map();
  for (const s of db
    .prepare(`SELECT * FROM lead_sessions WHERE room_id IN (${inList(ids)}) ORDER BY start_time ASC`)
    .all(...ids)
    .map(rowToSession)) {
    agendaById.set(s.roomId, [...(agendaById.get(s.roomId) || []), toSession(s)]);
  }

  return points.map((p) => {
    const v = visits.get(p._id);
    return toPoint(p, {
      totalScans: v?.total || 0,
      uniqueAttendees: v?.uniq || 0,
      ...(p.type === "room"
        ? { liveCount: live.get(p._id) || 0, agenda: agendaById.get(p._id) || [] }
        : { ratings: { hot: 0, warm: 0, cold: 0, ...ratingsById.get(p._id) } }),
    });
  });
}

const withStatsOne = (point) => withStats([point])[0];
const reloadPoint = (point) => rowToPoint(db.prepare(`SELECT * FROM lead_points WHERE id = ?`).get(point._id));

// ─── Admin: points ────────────────────────────────────────────────────────────

function getPoints(eventId, type) {
  closeStaleVisits(eventId);
  const filter = ["booth", "room"].includes(type) ? " AND type = ?" : "";
  const rows = db
    .prepare(`SELECT * FROM lead_points WHERE event_id = ?${filter} ORDER BY type ASC, created_at ASC`)
    .all(eventId, ...(filter ? [type] : []));
  return { data: withStats(rows.map(rowToPoint)) };
}

/** Validates and picks the editable fields; returns { error } or { fields } */
function readPointBody(body, type) {
  const fields = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) return { error: "Name is required" };
    fields.name = body.name.trim();
  }
  if (type === "booth") {
    if (body.exhibitorName !== undefined) fields.exhibitor_name = String(body.exhibitorName || "").trim();
    return { fields };
  }
  if (body.capacity !== undefined) {
    const c = body.capacity === null || body.capacity === "" ? null : Number(body.capacity);
    if (c !== null && (!Number.isInteger(c) || c < 0)) return { error: "Capacity must be a whole number" };
    fields.capacity = c;
  }
  return { fields };
}

function createPoint(eventId, body) {
  const { type } = body;
  if (!["booth", "room"].includes(type)) return err(400, "Type must be booth or room");
  if (body.name === undefined) return err(400, "Name is required");
  const { error, fields } = readPointBody(body, type);
  if (error) return err(400, error);

  const now = iso(Date.now());
  const id = newId();
  db.prepare(
    `INSERT INTO lead_points (id, event_id, name, type, exhibitor_name, capacity, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, eventId, fields.name, type, fields.exhibitor_name || "", fields.capacity ?? null, now, now);
  return { data: withStatsOne(getPointRow(eventId, id)), status: 201, message: "Capture point created" };
}

function updatePoint(eventId, id, body) {
  const point = getPointRow(eventId, id);
  if (!point) return err(404, "Capture point not found");
  const { error, fields } = readPointBody(body, point.type);
  if (error) return err(400, error);
  const keys = Object.keys(fields);
  if (keys.length) {
    db.prepare(
      `UPDATE lead_points SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ?, sync_state = 'dirty' WHERE id = ?`,
    ).run(...keys.map((k) => fields[k]), iso(Date.now()), id);
  }
  return { data: withStatsOne(reloadPoint(point)), message: "Capture point updated" };
}

/** Refused once it has scans, so report data isn't lost */
const deletePoint = db.transaction((eventId, id) => {
  const point = getPointRow(eventId, id);
  if (!point) return err(404, "Capture point not found");
  if (db.prepare(`SELECT 1 FROM lead_visits WHERE point_id = ? LIMIT 1`).get(id)) {
    return err(409, "This point already has scans and can't be deleted. Delete its link to stop scanning.");
  }
  for (const s of db.prepare(`SELECT id FROM lead_sessions WHERE room_id = ?`).all(id)) {
    addTombstone("session", s.id, eventId);
  }
  db.prepare(`DELETE FROM lead_sessions WHERE room_id = ?`).run(id);
  db.prepare(`DELETE FROM lead_points WHERE id = ?`).run(id);
  addTombstone("point", id, eventId);
  return { data: { _id: id }, message: "Capture point deleted" };
});

// Scanner links are local to this PC — not marked dirty, never synced

function createLink(eventId, id) {
  const point = getPointRow(eventId, id);
  if (!point) return err(404, "Capture point not found");
  if (linkLive(point)) return { data: withStatsOne(point), message: "Scanner link already exists" };
  db.prepare(`UPDATE lead_points SET scan_token = ?, token_expires_at = ? WHERE id = ?`).run(
    newToken(),
    iso(Date.now() + LINK_VALIDITY_MS),
    id,
  );
  return { data: withStatsOne(reloadPoint(point)), status: 201, message: "Scanner link created" };
}

function deleteLink(eventId, id) {
  const point = getPointRow(eventId, id);
  if (!point?.scanToken) return err(404, "No scanner link to delete");
  db.prepare(`UPDATE lead_points SET scan_token = NULL, token_expires_at = NULL WHERE id = ?`).run(id);
  return { data: withStatsOne(reloadPoint(point)), message: "Scanner link deleted" };
}

function getLiveRooms(eventId) {
  closeStaleVisits(eventId);
  const rooms = db
    .prepare(`SELECT id, name, capacity FROM lead_points WHERE event_id = ? AND type = 'room' ORDER BY created_at ASC`)
    .all(eventId);
  const live = liveCounts(rooms.map((r) => r.id));
  return { data: rooms.map((r) => ({ _id: r.id, name: r.name, capacity: r.capacity, liveCount: live.get(r.id) || 0 })) };
}

function getScreen(eventId, id) {
  const point = getPointRow(eventId, id);
  if (!point) return err(404, "Capture point not found");
  return { data: toScreenSettings(point.screen) };
}

function updateScreen(eventId, id, body) {
  const point = getPointRow(eventId, id);
  if (!point) return err(404, "Capture point not found");
  const { error, settings } = readScreenSettings(body);
  if (error) return err(400, error);
  db.prepare(`UPDATE lead_points SET screen = ?, updated_at = ?, sync_state = 'dirty' WHERE id = ?`).run(
    JSON.stringify(settings),
    iso(Date.now()),
    id,
  );
  return { data: toScreenSettings(settings), message: "Screen settings saved" };
}

/**
 * Admin "out entry": closes open visits in this room at the current time.
 * attendeeId (report row key) → only that person; without it everyone still in the room.
 */
function checkoutRoom(eventId, id, attendeeId) {
  const point = getPointRow(eventId, id);
  if (!point || point.type !== "room") return err(404, "Room not found");
  if (attendeeId !== undefined && typeof attendeeId !== "string") return err(400, "Invalid attendee");

  closeStaleVisits(eventId);
  const now = iso(Date.now());
  let who = "";
  const params = [];
  if (attendeeId) {
    if (attendeeId.startsWith("cloud:")) {
      who = " AND attendee_cloud_id = ?";
      params.push(attendeeId.slice(6));
    } else {
      who = " AND attendee_email = ?";
      params.push(attendeeId.toLowerCase());
    }
  }
  const { changes } = db
    .prepare(
      `UPDATE lead_visits SET status = 'out', out_time = ?, out_reason = 'admin-checkout', is_exit_estimated = 0,
              updated_at = ?, sync_state = 'dirty'
       WHERE point_id = ? AND status = 'in'${who}`,
    )
    .run(now, now, id, ...params);
  if (attendeeId && !changes) return err(404, "This person is not in the room");

  const message = attendeeId
    ? "Checked out"
    : changes
      ? `Checked out ${changes} ${changes === 1 ? "person" : "people"}`
      : "No one was in the room";
  return { data: { ...withStatsOne(point), checkedOut: changes }, message };
}

// ─── Admin: agenda ────────────────────────────────────────────────────────────

function readSessionBody(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { error: "Session title is required" };
  if (title.length > 200) return { error: "Title must be 200 characters or fewer" };
  const speaker = typeof body.speaker === "string" ? body.speaker.trim() : "";
  if (speaker.length > 200) return { error: "Speaker must be 200 characters or fewer" };
  const startTime = toDate(body.startTime);
  const endTime = toDate(body.endTime);
  if (!startTime || !endTime) return { error: "Start and end time are required" };
  if (endTime <= startTime) return { error: "End time must be after start time" };
  return { fields: { title, speaker, startTime, endTime } };
}

function readActualTimes(body) {
  const fields = {};
  for (const key of ["actualStartTime", "actualEndTime"]) {
    if (body[key] === undefined) continue;
    const d = toDate(body[key]);
    if (d === undefined) return { error: `Invalid ${key}` };
    fields[key] = d;
  }
  return { fields };
}

const findOverlap = (roomId, { startTime, endTime }, excludeId) =>
  db
    .prepare(
      `SELECT title FROM lead_sessions WHERE room_id = ? AND start_time < ? AND end_time > ?${excludeId ? " AND id != ?" : ""} LIMIT 1`,
    )
    .get(roomId, iso(endTime), iso(startTime), ...(excludeId ? [excludeId] : []));

const overlapMessage = (s) => `Overlaps "${s.title}" in this room. Sessions in a room can't overlap.`;

const findRoom = (eventId, id) => {
  const p = getPointRow(eventId, id);
  return p?.type === "room" ? p : null;
};

const addSession = db.transaction((eventId, roomId, body) => {
  const room = findRoom(eventId, roomId);
  if (!room) return err(404, "Room not found");
  const { error, fields } = readSessionBody(body);
  if (error) return err(400, error);
  const clash = findOverlap(room._id, fields);
  if (clash) return err(409, overlapMessage(clash));

  const now = iso(Date.now());
  db.prepare(
    `INSERT INTO lead_sessions (id, event_id, room_id, title, speaker, start_time, end_time, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(newId(), eventId, room._id, fields.title, fields.speaker, iso(fields.startTime), iso(fields.endTime), now, now);
  refreshAutoClose(room);
  return { data: withStatsOne(room), status: 201, message: "Session added" };
});

const updateSession = db.transaction((eventId, roomId, sessionId, body) => {
  const room = findRoom(eventId, roomId);
  if (!room) return err(404, "Room not found");
  if (!isId(sessionId)) return err(400, "Invalid session");
  const { error, fields } = readSessionBody(body);
  if (error) return err(400, error);
  const actual = readActualTimes(body);
  if (actual.error) return err(400, actual.error);
  const merged = { ...fields, ...actual.fields };
  if (merged.actualEndTime && !merged.actualStartTime && body.actualStartTime !== undefined)
    return err(400, "Set the actual start before the actual end");
  if (merged.actualStartTime && merged.actualEndTime && merged.actualEndTime <= merged.actualStartTime)
    return err(400, "Actual end must be after actual start");
  const clash = findOverlap(room._id, fields, sessionId);
  if (clash) return err(409, overlapMessage(clash));

  const cols = { title: merged.title, speaker: merged.speaker, start_time: iso(merged.startTime), end_time: iso(merged.endTime) };
  if ("actualStartTime" in merged) cols.actual_start_time = merged.actualStartTime ? iso(merged.actualStartTime) : null;
  if ("actualEndTime" in merged) cols.actual_end_time = merged.actualEndTime ? iso(merged.actualEndTime) : null;
  const keys = Object.keys(cols);
  const { changes } = db
    .prepare(
      `UPDATE lead_sessions SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ?, sync_state = 'dirty'
       WHERE id = ? AND room_id = ?`,
    )
    .run(...keys.map((k) => cols[k]), iso(Date.now()), sessionId, room._id);
  if (!changes) return err(404, "Session not found");

  refreshAutoClose(room);
  return { data: withStatsOne(room), message: "Session updated" };
});

/** Scans are kept (they belong to the room) */
const deleteSession = db.transaction((eventId, roomId, sessionId) => {
  const room = findRoom(eventId, roomId);
  if (!room) return err(404, "Room not found");
  if (!isId(sessionId)) return err(400, "Invalid session");
  const { changes } = db.prepare(`DELETE FROM lead_sessions WHERE id = ? AND room_id = ?`).run(sessionId, room._id);
  if (!changes) return err(404, "Session not found");
  addTombstone("session", sessionId, eventId);
  refreshAutoClose(room);
  return { data: withStatsOne(room), message: "Session deleted" };
});

// ─── Universal scanner link (one per event, local to this PC) ─────────────────

const toEventLink = (row) =>
  row && ms(row.token_expires_at) > Date.now()
    ? { scanToken: row.scan_token, tokenExpiresAt: row.token_expires_at }
    : { scanToken: null, tokenExpiresAt: null };

const getEventLink = (eventId) => ({
  data: toEventLink(db.prepare(`SELECT * FROM lead_links WHERE event_id = ?`).get(eventId)),
});

function createEventLink(eventId) {
  const existing = db.prepare(`SELECT * FROM lead_links WHERE event_id = ?`).get(eventId);
  if (existing && ms(existing.token_expires_at) > Date.now())
    return { data: toEventLink(existing), message: "Scanner link already exists" };
  const now = Date.now();
  db.prepare(
    `INSERT OR REPLACE INTO lead_links (event_id, scan_token, token_expires_at, created_at) VALUES (?, ?, ?, ?)`,
  ).run(eventId, newToken(), iso(now + LINK_VALIDITY_MS), iso(now));
  return { ...getEventLink(eventId), status: 201, message: "Scanner link created" };
}

function deleteEventLink(eventId) {
  const { changes } = db.prepare(`DELETE FROM lead_links WHERE event_id = ?`).run(eventId);
  if (!changes) return err(404, "No scanner link to delete");
  return { data: toEventLink(null), message: "Scanner link deleted" };
}

// ─── Public scanner (LAN link) ────────────────────────────────────────────────

/** :token → the capture point with a live link, or { error } */
function pointByToken(token) {
  if (typeof token !== "string" || token.length < 20) return err(404, INVALID_LINK);
  const row = db
    .prepare(`SELECT * FROM lead_points WHERE scan_token = ? AND token_expires_at > ?`)
    .get(token, iso(Date.now()));
  return row ? { point: rowToPoint(row) } : err(404, INVALID_LINK);
}

/** Universal link :token → its live link row, or { error } */
function eventLinkByToken(token) {
  if (typeof token !== "string" || token.length < 20) return err(404, INVALID_LINK);
  const link = db
    .prepare(`SELECT * FROM lead_links WHERE scan_token = ? AND token_expires_at > ?`)
    .get(token, iso(Date.now()));
  return link ? { link } : err(404, INVALID_LINK);
}

/** Universal link: the booth / room picked on the device */
function pointForEventLink(link, pointId) {
  const point = getPointRow(link.event_id, pointId);
  if (!point) return err(404, "This booth or room no longer exists");
  return { point: { ...point, tokenExpiresAt: link.token_expires_at } };
}

function getEventScannerInfo(link, eventName) {
  closeStaleVisits(link.event_id);
  const points = db
    .prepare(`SELECT * FROM lead_points WHERE event_id = ? ORDER BY name COLLATE NOCASE ASC`)
    .all(link.event_id)
    .map(rowToPoint);
  const rooms = points.filter((p) => p.type === "room");
  const live = liveCounts(rooms.map((r) => r._id));
  return {
    data: {
      eventName: eventName || "",
      expiresAt: link.token_expires_at,
      booths: points
        .filter((p) => p.type === "booth")
        .map((p) => ({ _id: p._id, name: p.name, exhibitorName: p.exhibitorName })),
      rooms: rooms.map((r) => ({
        _id: r._id,
        name: r.name,
        capacity: r.capacity,
        liveCount: live.get(r._id) || 0,
        agenda: agendaOf(r._id),
      })),
    },
  };
}

function getScannerInfo(point) {
  let room = {};
  if (point.type === "room") {
    closeStaleVisits(point.eventId);
    room = { liveCount: liveCounts([point._id]).get(point._id) || 0, agenda: agendaOf(point._id) };
  }
  return {
    data: {
      name: point.name,
      type: point.type,
      exhibitorName: point.exhibitorName,
      capacity: point.capacity,
      expiresAt: point.tokenExpiresAt,
      screen: toScreenSettings(point.screen),
      ...room,
    },
  };
}

function scanBooth(point, attendee, now) {
  const email = attendee.email.toLowerCase();
  const last = db
    .prepare(`SELECT in_time FROM lead_visits WHERE point_id = ? AND attendee_email = ? ORDER BY in_time DESC LIMIT 1`)
    .get(point._id, email);
  const duplicate = Boolean(last) && now - ms(last.in_time) < DUPLICATE_WINDOW_MS;
  const nowIso = iso(now);

  if (!duplicate) {
    db.prepare(
      `INSERT INTO lead_visits (id, event_id, point_id, attendee_email, attendee_cloud_id, type, in_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'booth', ?, ?, ?)`,
    ).run(newId(), point.eventId, point._id, email, attendee.cloudId || null, nowIso, nowIso, nowIso);
  }

  let lead = db.prepare(`SELECT * FROM lead_booth_leads WHERE point_id = ? AND attendee_email = ?`).get(point._id, email);
  if (!lead) {
    db.prepare(
      `INSERT INTO lead_booth_leads (id, event_id, point_id, attendee_email, attendee_cloud_id, visit_count,
         first_visit_at, last_visit_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(newId(), point.eventId, point._id, email, attendee.cloudId || null, duplicate ? 0 : 1, nowIso,
      duplicate ? null : nowIso, nowIso, nowIso);
  } else if (!duplicate) {
    db.prepare(
      `UPDATE lead_booth_leads SET visit_count = visit_count + 1, last_visit_at = ?,
              attendee_cloud_id = COALESCE(attendee_cloud_id, ?), updated_at = ?, sync_state = 'dirty'
       WHERE id = ?`,
    ).run(nowIso, attendee.cloudId || null, nowIso, lead.id);
  }
  lead = db.prepare(`SELECT * FROM lead_booth_leads WHERE point_id = ? AND attendee_email = ?`).get(point._id, email);

  return {
    leadId: lead.id,
    result: duplicate ? "duplicate" : lead.visit_count > 1 ? "revisited" : "visited",
    visitCount: lead.visit_count,
    rating: lead.rating,
    note: lead.note,
  };
}

// Out times are only ever the moment of a real scan (or no out time at all)
const closeVisit = (visitId, outTime, outReason) =>
  db
    .prepare(
      `UPDATE lead_visits SET status = 'out', out_time = ?, out_reason = ?, is_exit_estimated = 0,
              updated_at = ?, sync_state = 'dirty'
       WHERE id = ? AND status = 'in'`,
    )
    .run(iso(outTime), outReason, iso(outTime), visitId);

/**
 * One badge scan at a room. `mode`: smart | entry | exit.
 * `confirm` answers a popup the previous call asked for: "out" (smart mode, already in this
 * room) or "move" (in another room). Without it those two cases return "confirm-out" /
 * "confirm-move" and save nothing.
 */
function scanRoom(point, attendee, now, mode, confirm) {
  const email = attendee.email.toLowerCase();
  const timeZone = eventTimeZone();
  let open = db
    .prepare(
      `SELECT v.*, p.name AS point_name FROM lead_visits v LEFT JOIN lead_points p ON p.id = v.point_id
       WHERE v.event_id = ? AND v.attendee_email = ? AND v.status = 'in' ORDER BY v.in_time DESC LIMIT 1`,
    )
    .get(point.eventId, email);

  // Still open from a day that's over (never scanned out) — close it with no out time
  if (open?.auto_close_at && ms(open.auto_close_at) <= now) {
    db.prepare(
      `UPDATE lead_visits SET status = 'out', out_reason = 'no-exit-scan', updated_at = ?, sync_state = 'dirty'
       WHERE id = ? AND status = 'in'`,
    ).run(iso(now), open.id);
    open = null;
  }
  const inThisRoom = open && open.point_id === point._id;
  const otherRoom =
    open && !inThisRoom ? { fromRoom: open.point_name || "another room", since: open.in_time } : null;

  // Double beep: this badge was already scanned in or out here in the last 30 s
  if (!confirm) {
    const since = iso(now - ROOM_DUPLICATE_MS);
    const recent = db
      .prepare(
        `SELECT 1 FROM lead_visits WHERE point_id = ? AND attendee_email = ? AND (in_time > ? OR out_time > ?) LIMIT 1`,
      )
      .get(point._id, email, since, since);
    if (recent) return { result: "duplicate" };
  }

  const minutesIn = () => Math.round((now - ms(open.in_time)) / 60000);

  if (mode === "exit") {
    if (inThisRoom) {
      closeVisit(open.id, now, "exit-scan");
      return { result: "exited", minutes: minutesIn() };
    }
    return otherRoom ? { result: "in-other-room", ...otherRoom } : { result: "not-in" };
  }

  if (inThisRoom) {
    if (mode === "entry") return { result: "already-in", since: open.in_time };
    if (confirm !== "out") return { result: "confirm-out", since: open.in_time };
    closeVisit(open.id, now, "exit-scan");
    return { result: "exited", minutes: minutesIn() };
  }
  // Confirmed OUT, but someone else already scanned them out meanwhile — never turn it into an IN
  if (confirm === "out") return { result: "not-in" };

  if (otherRoom) {
    if (confirm !== "move") return { result: "confirm-move", ...otherRoom };
    closeVisit(open.id, now, "moved-to-other-room");
  }

  const nowIso = iso(now);
  db.prepare(
    `INSERT INTO lead_visits (id, event_id, point_id, attendee_email, attendee_cloud_id, type, in_time, status,
       auto_close_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'room', ?, 'in', ?, ?, ?)`,
  ).run(newId(), point.eventId, point._id, email, attendee.cloudId || null, nowIso,
    iso(autoCloseFor(point._id, now, timeZone)), nowIso, nowIso);
  return { result: otherRoom ? "moved" : "entered", ...(otherRoom && { movedFrom: otherRoom.fromRoom }) };
}

/**
 * Scan at a booth / room — body { id, mode?, confirm? }. id: the raw badge QR text
 * (resolved like the scan page's check-in: uniqueUserId, cloud _id, older JSON badges).
 * Rooms: mode smart | entry | exit (default entry, as on the cloud).
 */
const scanAtPoint = db.transaction((point, body) => {
  const { id, mode = "entry", confirm } = body || {};
  if (!ROOM_MODES.includes(mode)) return err(400, "Mode must be smart, entry or exit");
  if (confirm !== undefined && !["out", "move"].includes(confirm)) return err(400, "Invalid confirm");

  const found = findBadgeRow(id, point.eventId);
  if (found.error) {
    const [status, message] = found.error;
    return err(status, status === 404 ? "Badge not found for this event" : message);
  }
  const attendee = found.row;

  const now = Date.now();
  const { leadId, ...outcome } =
    point.type === "booth" ? scanBooth(point, attendee, now) : scanRoom(point, attendee, now, mode, confirm);

  let room = {};
  if (point.type === "room") {
    room = {
      liveCount: liveCounts([point._id]).get(point._id) || 0,
      session: runningSession(agendaOf(point._id))?.title || null,
    };
  }

  return {
    data: {
      ...outcome,
      attendee: {
        // Booth: the lead's id, sent back by the rating form (no email on scanner devices)
        _id: leadId || null,
        name: displayName(attendee),
        ...(point.type === "booth" && {
          organization: attendee.organization || "",
          designation: attendee.designation || "",
        }),
      },
      ...room,
    },
    message: "Scanned",
  };
});

/**
 * A volunteer starts a session in this room now: it gets its actual start (or reopens if it
 * had ended) and the session running until now ends now. Undoing a pick within 2 minutes
 * puts that session back to "not started".
 */
const startSession = db.transaction((point, sessionId) => {
  if (point.type !== "room") return err(400, "Sessions are only for rooms");
  if (!isId(sessionId)) return err(400, "Invalid session");
  closeStaleVisits(point.eventId);
  const row = db.prepare(`SELECT * FROM lead_sessions WHERE id = ? AND room_id = ?`).get(sessionId, point._id);
  if (!row) return err(404, "This session is no longer on the agenda");
  const session = rowToSession(row);

  const now = Date.now();
  const nowIso = iso(now);
  const set = db.prepare(
    `UPDATE lead_sessions SET actual_start_time = ?, actual_end_time = ?, updated_at = ?, sync_state = 'dirty' WHERE id = ?`,
  );
  const running = db
    .prepare(
      `SELECT * FROM lead_sessions WHERE room_id = ? AND id != ? AND actual_start_time IS NOT NULL AND actual_end_time IS NULL`,
    )
    .all(point._id, session._id)
    .map(rowToSession);
  for (const r of running) {
    if (now - ms(r.actualStartTime) < MISTAKE_WINDOW_MS) set.run(null, null, nowIso, r._id);
    else set.run(r.actualStartTime, nowIso, nowIso, r._id);
  }
  if (!session.actualStartTime || session.actualEndTime) {
    set.run(session.actualStartTime || nowIso, null, nowIso, session._id);
  }

  refreshAutoClose(point);
  return { data: { agenda: agendaOf(point._id) }, message: `${session.title} started` };
});

/** Booths only, after a scan — body { attendeeId (the lead id from the scan), rating?, note? } */
function rateLead(point, body) {
  if (point.type !== "booth") return err(400, "Ratings are only for booths");
  const { attendeeId, rating, note } = body || {};
  if (!isId(attendeeId)) return err(400, "Invalid attendee");

  const set = {};
  if (rating !== undefined) {
    if (rating !== null && !RATINGS.includes(rating)) return err(400, "Rating must be hot, warm or cold");
    set.rating = rating;
  }
  if (note !== undefined) {
    if (typeof note !== "string" || note.length > 1000) return err(400, "Note must be up to 1000 characters");
    set.note = note.trim();
  }
  const keys = Object.keys(set);
  if (!keys.length) return err(400, "Nothing to save");

  // Only leads scanned at this booth can be rated
  const { changes } = db
    .prepare(
      `UPDATE lead_booth_leads SET ${keys.map((k) => `${k} = ?`).join(", ")}, updated_at = ?, sync_state = 'dirty'
       WHERE id = ? AND point_id = ?`,
    )
    .run(...keys.map((k) => set[k]), iso(Date.now()), attendeeId, point._id);
  if (!changes) return err(404, "Scan this badge first");
  const lead = db.prepare(`SELECT rating, note FROM lead_booth_leads WHERE id = ?`).get(attendeeId);
  return { data: { rating: lead.rating, note: lead.note }, message: "Lead saved" };
}

module.exports = {
  // shared with the report
  isId,
  getPointRow,
  rowToSession,
  rowToVisit,
  attendeeKey,
  closeStaleVisits,
  // admin
  getPoints,
  createPoint,
  updatePoint,
  deletePoint,
  createLink,
  deleteLink,
  getLiveRooms,
  getScreen,
  updateScreen,
  checkoutRoom,
  addSession,
  updateSession,
  deleteSession,
  getEventLink,
  createEventLink,
  deleteEventLink,
  // public
  pointByToken,
  eventLinkByToken,
  pointForEventLink,
  getEventScannerInfo,
  getScannerInfo,
  scanAtPoint,
  startSession,
  rateLead,
};
