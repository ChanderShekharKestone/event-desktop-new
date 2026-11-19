/**
 * Lead capture cloud sync with the offline API (VosmosVirtualEvents routes/Offline.js,
 * controllers/offlineLeadCapture.js — merge rules are documented there).
 *
 *   GET  {LEAD_CLOUD_BASE}/:eventId  → points, sessions, visits, leads, event name / zone
 *   POST {LEAD_CLOUD_BASE}/push      → { done, rejected, leadIds }
 *
 * Push: rows with sync_state 'dirty' and tombstones, in batches. A row is marked 'synced' only
 * if it wasn't edited while the request was out (same updated_at). Visits / leads of a delegate
 * not on the cloud yet (no cloudId) wait, like giveaways.
 * Pull: the cloud copy replaces 'synced' rows; 'dirty' rows win until pushed. Scanner links
 * (scan_token) are this PC's own and never touched.
 */
const axios = require("axios");
const { db } = require("../db");
const settings = require("../settings");
const config = require("../config");

const BATCH = 500;
const TIMEOUT_MS = 30000;
const TABLE = { point: "lead_points", session: "lead_sessions", visit: "lead_visits", lead: "lead_booth_leads" };

const api = () => config.LEAD_CLOUD_BASE;
const request = { headers: config.LEAD_CLOUD_HEADERS, timeout: TIMEOUT_MS };
const iso = (v) => (v ? new Date(v).toISOString() : null);
const parseJson = (s, fallback) => {
  try {
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
};
const chunks = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/** Visits / leads scanned before the delegate reached the cloud: fill in their cloud id now */
function resolveAttendees(eventId) {
  for (const t of ["lead_visits", "lead_booth_leads"]) {
    db.prepare(
      `UPDATE ${t} SET attendee_cloud_id = (
         SELECT r.cloudId FROM registrations r
         WHERE r.eventId = ${t}.event_id AND LOWER(r.email) = ${t}.attendee_email AND r.cloudId IS NOT NULL
       )
       WHERE event_id = ? AND attendee_cloud_id IS NULL AND attendee_email IS NOT NULL`,
    ).run(eventId);
  }
}

// ─── Desktop rows → cloud shapes ──────────────────────────────────────────────

const pointOut = (r) => ({
  _id: r.id, name: r.name, type: r.type, exhibitorName: r.exhibitor_name, capacity: r.capacity,
  screen: parseJson(r.screen, {}), createdAt: r.created_at, updatedAt: r.updated_at,
});
const sessionOut = (r) => ({
  _id: r.id, roomId: r.room_id, title: r.title, speaker: r.speaker, startTime: r.start_time, endTime: r.end_time,
  actualStartTime: r.actual_start_time, actualEndTime: r.actual_end_time, createdAt: r.created_at, updatedAt: r.updated_at,
});
const visitOut = (r) => ({
  _id: r.id, pointId: r.point_id, attendeeId: r.attendee_cloud_id, type: r.type, inTime: r.in_time,
  outTime: r.out_time, status: r.status, outReason: r.out_reason, isExitEstimated: Boolean(r.is_exit_estimated),
  autoCloseAt: r.auto_close_at, createdAt: r.created_at, updatedAt: r.updated_at,
});
const leadOut = (r) => ({
  _id: r.id, pointId: r.point_id, attendeeId: r.attendee_cloud_id, rating: r.rating, note: r.note,
  ratedAt: r.rated_at, // null: rating / note not changed here — the cloud keeps its own
  firstVisitAt: r.first_visit_at, lastVisitAt: r.last_visit_at, createdAt: r.created_at, updatedAt: r.updated_at,
});

const dirty = (table, eventId, extra = "") =>
  db.prepare(`SELECT * FROM ${table} WHERE event_id = ? AND sync_state = 'dirty'${extra} ORDER BY created_at ASC`).all(eventId);

// ─── Push ─────────────────────────────────────────────────────────────────────

async function post(eventId, payload) {
  const res = await axios.post(`${api()}/push`, { eventId, ...payload }, request);
  const data = res.data?.data;
  // A 200 without this shape is not the lead capture endpoint (older cloud) — keep everything
  if (!data?.done) throw new Error("Cloud lead capture API not available — changes kept on this PC");
  return data;
}

/** Marks pushed rows synced (unless edited meanwhile) and rejected rows with the reason */
function applyResult(eventId, rowsByKind, result) {
  const kindOfDone = { points: "point", sessions: "session", visits: "visit", leads: "lead" };
  db.transaction(() => {
    for (const [key, kind] of Object.entries(kindOfDone)) {
      const done = new Set(result.done[key] || []);
      const stmt = db.prepare(
        `UPDATE ${TABLE[kind]} SET sync_state = 'synced', sync_error = NULL WHERE id = ? AND updated_at = ?`,
      );
      for (const r of rowsByKind[kind] || []) if (done.has(r.id)) stmt.run(r.id, r.updated_at);
    }
    for (const rej of result.rejected || []) {
      if (TABLE[rej.kind]) {
        db.prepare(
          `UPDATE ${TABLE[rej.kind]} SET sync_state = 'rejected', sync_error = ? WHERE id = ? AND sync_state = 'dirty'`,
        ).run(String(rej.reason || "Rejected").slice(0, 300), rej._id);
      }
    }
    // Deletes are done either way: refused ones ("has scans on the cloud") come back on pull
    for (const id of [...(result.done.deletedPoints || []), ...(result.rejected || []).filter((r) => r.kind === "deletedPoint").map((r) => r._id)]) {
      db.prepare(`DELETE FROM lead_tombstones WHERE kind = 'point' AND id = ?`).run(id);
    }
    for (const id of result.done.deletedSessions || []) {
      db.prepare(`DELETE FROM lead_tombstones WHERE kind = 'session' AND id = ?`).run(id);
    }
    // Booth leads merged into an existing cloud lead take its id
    for (const [localId, cloudId] of Object.entries(result.leadIds || {})) {
      if (db.prepare(`SELECT 1 FROM lead_booth_leads WHERE id = ?`).get(cloudId)) {
        db.prepare(`DELETE FROM lead_booth_leads WHERE id = ?`).run(localId);
      } else {
        db.prepare(`UPDATE lead_booth_leads SET id = ? WHERE id = ?`).run(cloudId, localId);
      }
    }
  })();
}

async function pushLeads(eventId = settings.get("eventId")) {
  if (!eventId) return { pushed: 0 };
  resolveAttendees(eventId);
  let pushed = 0;

  // 1. Booths / rooms, sessions and deletes first — visits and leads point at them
  const points = dirty("lead_points", eventId);
  const sessions = dirty("lead_sessions", eventId);
  const tombstones = db.prepare(`SELECT kind, id FROM lead_tombstones WHERE event_id = ?`).all(eventId);
  const parts = chunks([...points.map((r) => ["point", r]), ...sessions.map((r) => ["session", r])], BATCH);
  if (!parts.length && tombstones.length) parts.push([]); // deletes only
  for (const [i, part] of parts.entries()) {
    const pts = part.filter(([k]) => k === "point").map(([, row]) => row);
    const ses = part.filter(([k]) => k === "session").map(([, row]) => row);
    const result = await post(eventId, {
      points: pts.map(pointOut),
      sessions: ses.map(sessionOut),
      // Deletes go with the first batch, after that batch's points / sessions are saved
      ...(i === 0 && {
        deleted: {
          points: tombstones.filter((t) => t.kind === "point").map((t) => t.id),
          sessions: tombstones.filter((t) => t.kind === "session").map((t) => t.id),
        },
      }),
    });
    applyResult(eventId, { point: pts, session: ses }, result);
    pushed += (result.done.points?.length || 0) + (result.done.sessions?.length || 0);
  }

  // 2. Visits, then booth leads (a lead's visit count is recounted from its visits)
  const ready = " AND attendee_cloud_id IS NOT NULL";
  for (const part of chunks(dirty("lead_visits", eventId, ready), BATCH)) {
    const result = await post(eventId, { visits: part.map(visitOut) });
    applyResult(eventId, { visit: part }, result);
    pushed += result.done.visits?.length || 0;
  }
  for (const part of chunks(dirty("lead_booth_leads", eventId, ready), BATCH)) {
    const result = await post(eventId, { leads: part.map(leadOut) });
    applyResult(eventId, { lead: part }, result);
    pushed += result.done.leads?.length || 0;
  }
  return { pushed };
}

// ─── Pull ─────────────────────────────────────────────────────────────────────

const applyPull = db.transaction((eventId, data) => {
  const emailByCloudId = new Map(
    db
      .prepare(`SELECT cloudId, LOWER(email) AS email FROM registrations WHERE eventId = ? AND cloudId IS NOT NULL`)
      .all(eventId)
      .map((r) => [r.cloudId, r.email]),
  );
  const tombstoned = new Set(db.prepare(`SELECT id FROM lead_tombstones WHERE event_id = ?`).all(eventId).map((t) => t.id));
  const stateOf = (table, id) => db.prepare(`SELECT sync_state FROM ${table} WHERE id = ?`).get(id)?.sync_state;
  const localWins = (table, id) => tombstoned.has(id) || stateOf(table, id) === "dirty";

  // Points (scan_token / token_expires_at are this PC's — never overwritten)
  const cloudPointIds = new Set();
  const upsertPoint = db.prepare(
    `INSERT INTO lead_points (id, event_id, name, type, exhibitor_name, capacity, screen, created_at, updated_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, type = excluded.type, exhibitor_name = excluded.exhibitor_name,
       capacity = excluded.capacity, screen = excluded.screen, created_at = excluded.created_at,
       updated_at = excluded.updated_at, sync_state = 'synced', sync_error = NULL`,
  );
  for (const p of data.points || []) {
    const id = String(p._id);
    cloudPointIds.add(id);
    if (localWins("lead_points", id)) continue;
    upsertPoint.run(id, eventId, p.name, p.type, p.exhibitorName || "", p.capacity ?? null,
      JSON.stringify(p.screen || {}), iso(p.createdAt) || iso(Date.now()), iso(p.updatedAt) || iso(Date.now()));
  }

  // Sessions
  const cloudSessionIds = new Set();
  const upsertSession = db.prepare(
    `INSERT INTO lead_sessions (id, event_id, room_id, title, speaker, start_time, end_time, actual_start_time,
       actual_end_time, created_at, updated_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
     ON CONFLICT(id) DO UPDATE SET room_id = excluded.room_id, title = excluded.title, speaker = excluded.speaker,
       start_time = excluded.start_time, end_time = excluded.end_time, actual_start_time = excluded.actual_start_time,
       actual_end_time = excluded.actual_end_time, created_at = excluded.created_at, updated_at = excluded.updated_at,
       sync_state = 'synced', sync_error = NULL`,
  );
  for (const s of data.sessions || []) {
    const id = String(s._id);
    cloudSessionIds.add(id);
    if (localWins("lead_sessions", id)) continue;
    upsertSession.run(id, eventId, String(s.roomId), s.title, s.speaker || "", iso(s.startTime), iso(s.endTime),
      iso(s.actualStartTime), iso(s.actualEndTime), iso(s.createdAt) || iso(Date.now()), iso(s.updatedAt) || iso(Date.now()));
  }

  // Deleted on the cloud: synced rows the cloud no longer has (a point only when no scans here)
  for (const s of db.prepare(`SELECT id FROM lead_sessions WHERE event_id = ? AND sync_state = 'synced'`).all(eventId)) {
    if (!cloudSessionIds.has(s.id)) db.prepare(`DELETE FROM lead_sessions WHERE id = ?`).run(s.id);
  }
  for (const p of db.prepare(`SELECT id FROM lead_points WHERE event_id = ? AND sync_state = 'synced'`).all(eventId)) {
    if (cloudPointIds.has(p.id)) continue;
    if (db.prepare(`SELECT 1 FROM lead_visits WHERE point_id = ? LIMIT 1`).get(p.id)) continue;
    db.prepare(`DELETE FROM lead_sessions WHERE room_id = ? AND sync_state = 'synced'`).run(p.id);
    db.prepare(`DELETE FROM lead_points WHERE id = ?`).run(p.id);
  }

  // Visits (attendee email from this PC's registrations; null when the delegate isn't here)
  const upsertVisit = db.prepare(
    `INSERT INTO lead_visits (id, event_id, point_id, attendee_email, attendee_cloud_id, type, in_time, out_time, status,
       out_reason, is_exit_estimated, auto_close_at, created_at, updated_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
     ON CONFLICT(id) DO UPDATE SET point_id = excluded.point_id, attendee_email = excluded.attendee_email,
       attendee_cloud_id = excluded.attendee_cloud_id, type = excluded.type, in_time = excluded.in_time,
       out_time = excluded.out_time, status = excluded.status, out_reason = excluded.out_reason,
       is_exit_estimated = excluded.is_exit_estimated, auto_close_at = excluded.auto_close_at,
       updated_at = excluded.updated_at, sync_state = 'synced', sync_error = NULL`,
  );
  for (const v of data.visits || []) {
    const id = String(v._id);
    if (localWins("lead_visits", id)) continue;
    const cloudAttendee = String(v.attendeeId);
    upsertVisit.run(id, eventId, String(v.pointId), emailByCloudId.get(cloudAttendee) || null, cloudAttendee, v.type,
      iso(v.inTime), iso(v.outTime), v.status || null, v.outReason || null, v.isExitEstimated ? 1 : 0,
      iso(v.autoCloseAt), iso(v.createdAt) || iso(v.inTime), iso(v.updatedAt) || iso(v.inTime));
  }

  // Booth leads — one per (booth, attendee): a synced local copy under another id gives way
  const upsertLead = db.prepare(
    `INSERT INTO lead_booth_leads (id, event_id, point_id, attendee_email, attendee_cloud_id, rating, note, visit_count,
       first_visit_at, last_visit_at, created_at, updated_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
     ON CONFLICT(id) DO UPDATE SET point_id = excluded.point_id, attendee_email = excluded.attendee_email,
       attendee_cloud_id = excluded.attendee_cloud_id, rating = excluded.rating, note = excluded.note,
       visit_count = excluded.visit_count, first_visit_at = excluded.first_visit_at, last_visit_at = excluded.last_visit_at,
       updated_at = excluded.updated_at, rated_at = NULL, sync_state = 'synced', sync_error = NULL`,
  );
  for (const l of data.leads || []) {
    const id = String(l._id);
    if (localWins("lead_booth_leads", id)) continue;
    const cloudAttendee = String(l.attendeeId);
    const email = emailByCloudId.get(cloudAttendee) || null;
    if (email) {
      const other = db
        .prepare(`SELECT id, sync_state FROM lead_booth_leads WHERE point_id = ? AND attendee_email = ? AND id != ?`)
        .get(String(l.pointId), email, id);
      if (other?.sync_state === "dirty") continue; // the next push merges it into this one
      if (other) db.prepare(`DELETE FROM lead_booth_leads WHERE id = ?`).run(other.id);
    }
    upsertLead.run(id, eventId, String(l.pointId), email, cloudAttendee, l.rating || null, l.note || "",
      l.visitCount || 0, iso(l.firstVisitAt), iso(l.lastVisitAt), iso(l.createdAt) || iso(Date.now()),
      iso(l.updatedAt) || iso(Date.now()));
  }
});

async function pullLeads(eventId = settings.get("eventId")) {
  if (!eventId) return { pulled: 0 };
  const res = await axios.get(`${api()}/${eventId}`, request);
  const data = res.data?.data;
  if (!data || !Array.isArray(data.points)) throw new Error("Unexpected lead capture response from cloud");
  // Used by the universal scanner, agenda days, auto check-out and CSV times
  if (data.event?.eventName) settings.set("eventName", data.event.eventName);
  if (data.event?.timeZone) settings.set("eventTimeZone", data.event.timeZone);
  applyPull(eventId, data);
  return { pulled: data.points.length };
}

// ─── Status + one-at-a-time sync ──────────────────────────────────────────────

/** dirty = not pushed yet; waiting = scans of a delegate not on the cloud yet; rejected = refused */
function getLeadSyncStatus(eventId = settings.get("eventId")) {
  if (!eventId) return { pending: 0, waiting: 0, rejected: [] };
  const count = (sql) => db.prepare(sql).get(eventId).c;
  let pending = count(`SELECT COUNT(*) AS c FROM lead_tombstones WHERE event_id = ?`);
  for (const t of Object.values(TABLE)) pending += count(`SELECT COUNT(*) AS c FROM ${t} WHERE event_id = ? AND sync_state = 'dirty'`);
  let waiting = 0;
  for (const t of ["lead_visits", "lead_booth_leads"]) {
    waiting += count(
      `SELECT COUNT(*) AS c FROM ${t} x WHERE x.event_id = ? AND x.sync_state = 'dirty' AND x.attendee_cloud_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.eventId = x.event_id AND LOWER(r.email) = x.attendee_email AND r.cloudId IS NOT NULL)`,
    );
  }
  const rejected = [];
  for (const [kind, t] of Object.entries(TABLE)) {
    for (const r of db.prepare(`SELECT id, sync_error FROM ${t} WHERE event_id = ? AND sync_state = 'rejected' LIMIT 20`).all(eventId))
      rejected.push({ kind, _id: r.id, reason: r.sync_error });
  }
  return { pending, waiting, rejected };
}

let running = null;

/** Push local changes, then pull the cloud copy. One run at a time. */
function syncLeads() {
  if (running) return running;
  running = (async () => {
    const eventId = settings.get("eventId");
    if (!eventId) return { pushed: 0, pulled: 0 };
    const { pushed } = await pushLeads(eventId);
    const { pulled } = await pullLeads(eventId);
    return { pushed, pulled };
  })().finally(() => {
    running = null;
  });
  return running;
}

// Only syncLeads is exported for running a sync, so two never overlap
module.exports = { syncLeads, getLeadSyncStatus };
