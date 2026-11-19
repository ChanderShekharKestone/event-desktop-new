/**
 * Lead capture reports — per booth / room, plus CSV exports. Ported from the diy-ui api
 * (controllers/leadReport.controller.js) to SQLite. Admin-only (this PC), so full contact
 * details are included. Room attendance per agenda session: utils/attendance.
 */
const { db } = require("../db");
const { getPointRow, rowToSession, rowToVisit, attendeeKey, closeStaleVisits } = require("./leadCapture");
const { attendanceFor, sessionStatus, sessionWindow, visitEndMs } = require("../utils/attendance");
const { formatDateTime, eventTimeZone, csvRow } = require("../utils/leadTime");

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const MAX_BUCKETS = 400; // keeps charts readable for long or odd time ranges

const EXIT_LABELS = {
  "exit-scan": "Exit scan",
  "moved-to-other-room": "Moved to another room",
  "re-entry": "Re-entered (missed exit)",
  "day-ended": "Agenda ended for the day",
  "admin-checkout": "Checked out by admin",
  "no-exit-scan": "No exit scan",
};

const fullName = (a) => `${a?.firstName || ""} ${a?.lastName || ""}`.trim();

/** Contact details from this PC's registrations, by email and by cloud id */
function contactsFor(eventId, records) {
  const emails = [...new Set(records.map((r) => r.attendeeEmail).filter(Boolean))];
  const cloudIds = [...new Set(records.map((r) => r.attendeeCloudId).filter(Boolean))];
  const byKey = new Map();
  const select = `SELECT firstName, lastName, email, mobile, organization, designation, cloudId FROM registrations WHERE eventId = ?`;
  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500);
    for (const a of db.prepare(`${select} AND LOWER(email) IN (${chunk.map(() => "?").join(",")})`).all(eventId, ...chunk))
      byKey.set(a.email.toLowerCase(), a);
  }
  for (let i = 0; i < cloudIds.length; i += 500) {
    const chunk = cloudIds.slice(i, i + 500);
    for (const a of db.prepare(`${select} AND cloudId IN (${chunk.map(() => "?").join(",")})`).all(eventId, ...chunk))
      byKey.set(`cloud:${a.cloudId}`, a);
  }
  return (r) => byKey.get(r.attendeeEmail) || byKey.get(`cloud:${r.attendeeCloudId}`);
}

const contact = (a) => ({
  name: fullName(a) || "Unknown",
  email: a?.email || "",
  mobile: a?.mobile || "",
  organization: a?.organization || "",
  designation: a?.designation || "",
});

const rowToLead = (r) => ({
  _id: r.id,
  pointId: r.point_id,
  attendeeEmail: r.attendee_email,
  attendeeCloudId: r.attendee_cloud_id,
  rating: r.rating,
  note: r.note || "",
  visitCount: r.visit_count,
  firstVisitAt: r.first_visit_at,
  lastVisitAt: r.last_visit_at,
});

/** pointId:attendeeKey → every booth visit time, oldest first (visits sorted by inTime) */
const visitTimesBy = (visits) => {
  const map = new Map();
  for (const v of visits) {
    const key = `${v.pointId}:${attendeeKey(v)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(v.inTime);
  }
  return map;
};

const visitsOf = (pointIds) =>
  pointIds.length
    ? db
        .prepare(`SELECT * FROM lead_visits WHERE point_id IN (${pointIds.map(() => "?").join(",")}) ORDER BY point_id, in_time ASC`)
        .all(...pointIds)
        .map(rowToVisit)
    : [];

// ─── Booth ────────────────────────────────────────────────────────────────────

function boothReport(point) {
  const leads = db
    .prepare(`SELECT * FROM lead_booth_leads WHERE point_id = ? ORDER BY last_visit_at DESC`)
    .all(point._id)
    .map(rowToLead);
  const visits = visitsOf([point._id]);
  const person = contactsFor(point.eventId, leads);
  const timesOf = visitTimesBy(visits);

  // Visits per hour, zero-filled between the first and last visit
  const byHour = [];
  if (visits.length) {
    const counts = new Map();
    for (const v of visits) {
      const h = Math.floor(v.inTime.getTime() / HOUR_MS) * HOUR_MS;
      counts.set(h, (counts.get(h) || 0) + 1);
    }
    const first = Math.min(...counts.keys());
    const last = Math.min(Math.max(...counts.keys()), first + (MAX_BUCKETS - 1) * HOUR_MS);
    for (let t = first; t <= last; t += HOUR_MS) byHour.push({ time: new Date(t), visits: counts.get(t) || 0 });
  }

  const ratings = { hot: 0, warm: 0, cold: 0 };
  for (const l of leads) if (l.rating) ratings[l.rating]++;

  return {
    summary: {
      leads: leads.length,
      totalVisits: visits.length,
      repeatVisitors: leads.filter((l) => l.visitCount > 1).length,
      ratings,
    },
    byHour,
    rows: leads.map((l) => ({
      attendeeId: attendeeKey(l),
      ...contact(person(l)),
      rating: l.rating,
      note: l.note,
      visitCount: l.visitCount,
      firstVisitAt: l.firstVisitAt,
      lastVisitAt: l.lastVisitAt,
      visitTimes: timesOf.get(`${point._id}:${attendeeKey(l)}`) || [],
    })),
  };
}

// ─── Room ─────────────────────────────────────────────────────────────────────

/** Most people in the room at once: sweep entries (+1) and exits (-1); exits first on ties */
const peakOccupancy = (intervals) => {
  const events = [];
  for (const [inT, outT] of intervals) events.push([inT, 1], [outT, -1]);
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let current = 0;
  let peak = { count: 0, at: null };
  for (const [t, d] of events) {
    current += d;
    if (current > peak.count) peak = { count: current, at: new Date(t) };
  }
  return peak;
};

/** Room visits as [inMs, endMs] per attendee — see visitEndMs for visits with no exit scan */
const intervalsByAttendee = (visits, now) => {
  const map = new Map();
  for (const v of visits) {
    const key = attendeeKey(v);
    map.set(key, [...(map.get(key) || []), [v.inTime.getTime(), visitEndMs(v, now)]]);
  }
  return map;
};

const sessionsOf = (roomIds) =>
  roomIds.length
    ? db
        .prepare(`SELECT * FROM lead_sessions WHERE room_id IN (${roomIds.map(() => "?").join(",")}) ORDER BY start_time ASC`)
        .all(...roomIds)
        .map(rowToSession)
    : [];

function roomReport(point) {
  closeStaleVisits(point.eventId);
  const visits = visitsOf([point._id]);
  const agenda = sessionsOf([point._id]);
  const person = contactsFor(point.eventId, visits);
  const now = Date.now();

  const intervals = visits.map((v) => [v.inTime.getTime(), visitEndMs(v, now)]);
  const byAttendeeIntervals = intervalsByAttendee(visits, now);

  // People in the room at each bucket, from the first session / scan to the last (or now)
  const occupancy = [];
  if (intervals.length) {
    const windows = agenda.map(sessionWindow);
    const start = Math.min(intervals[0][0], ...windows.map((w) => w.start));
    const lastOut = Math.max(...intervals.map((i) => i[1]));
    const agendaEnd = windows.length ? Math.max(...windows.map((w) => w.end)) : 0;
    const end = Math.min(now, Math.max(lastOut, agendaEnd));
    const span = Math.max(end - start, 0);
    const step = span > 12 * HOUR_MS ? HOUR_MS : 15 * MINUTE_MS;
    const first = Math.floor(start / step) * step;
    for (let t = first; t <= end && occupancy.length < MAX_BUCKETS; t += step) {
      occupancy.push({ time: new Date(t), count: intervals.filter(([i, o]) => i <= t && t < o).length });
    }
  }

  // One row per attendee, all their entries summed, plus their attendance per session
  const byAttendee = new Map();
  visits.forEach((v, idx) => {
    const key = attendeeKey(v);
    const row =
      byAttendee.get(key) ||
      { attendeeId: key, ...contact(person(v)), entries: 0, minutes: 0, firstIn: v.inTime, lastOut: null, isInNow: false, hasNoExitScan: false };
    const [inT, outT] = intervals[idx];
    row.entries++;
    row.minutes += (outT - inT) / MINUTE_MS;
    // Visits come oldest first, so the latest one decides: in now, its real out time, or none
    row.isInNow = v.status === "in";
    row.lastOut = v.outTime || null;
    if (v.status === "out" && !v.outTime) row.hasNoExitScan = true;
    byAttendee.set(key, row);
  });

  const sessionCounts = new Map(agenda.map((s) => [s._id, { attended: 0, partial: 0 }]));
  const rows = [...byAttendee.values()].map((r) => {
    const own = byAttendeeIntervals.get(r.attendeeId);
    const attendance = {};
    for (const s of agenda) {
      const a = attendanceFor(own, s);
      if (!a.status) continue;
      attendance[s._id] = a;
      sessionCounts.get(s._id)[a.status]++;
    }
    return { ...r, minutes: Math.round(r.minutes), attendance };
  });

  return {
    summary: {
      attended: rows.length,
      totalEntries: visits.length,
      inRoomNow: visits.filter((v) => v.status === "in").length,
      avgMinutes: rows.length ? Math.round(rows.reduce((s, r) => s + r.minutes, 0) / rows.length) : 0,
      peak: peakOccupancy(intervals),
      noExitScans: visits.filter((v) => v.status === "out" && !v.outTime).length,
    },
    agenda: agenda.map((s) => ({
      _id: s._id,
      title: s.title,
      speaker: s.speaker,
      startTime: s.startTime,
      endTime: s.endTime,
      actualStartTime: s.actualStartTime || null,
      actualEndTime: s.actualEndTime || null,
      status: sessionStatus(s, now),
      ...sessionCounts.get(s._id),
    })),
    occupancy,
    rows: rows.sort((a, b) => a.firstIn - b.firstIn),
  };
}

function getPointReport(eventId, id) {
  const point = getPointRow(eventId, id);
  if (!point) return { error: [404, "Capture point not found"] };
  const { scanToken, tokenExpiresAt, ...safePoint } = point;
  const report = point.type === "booth" ? boothReport(point) : roomReport(point);
  return { data: { point: safePoint, ...report } };
}

// ─── CSV export ───────────────────────────────────────────────────────────────

const timesUsed = (s) =>
  !s.actualStartTime
    ? "Scheduled (not started on scanner)"
    : s.actualEndTime
      ? "Actual"
      : "Actual start + scheduled length";

const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "export";

/**
 * CSV export — { type: booth|room, pointId?, view: attendance|entries }.
 * Booth: one row per lead. Room attendance: one row per person per session they were in
 * (raw entries when the rooms have no agenda). Room entries: one row per in/out pair.
 * Returns { error } or { filename, csv }.
 */
function exportLeads(eventId, { type, pointId, view: rawView }) {
  const view = rawView === "entries" ? "entries" : "attendance";
  if (!["booth", "room"].includes(type)) return { error: [400, "Type must be booth or room"] };

  let points;
  if (pointId) {
    const p = getPointRow(eventId, pointId);
    if (!p || p.type !== type) return { error: [404, "Capture point not found"] };
    points = [p];
  } else {
    points = db
      .prepare(`SELECT id FROM lead_points WHERE event_id = ? AND type = ? ORDER BY created_at ASC`)
      .all(eventId, type)
      .map((r) => getPointRow(eventId, r.id));
  }
  if (type === "room") closeStaleVisits(eventId);

  const tz = eventTimeZone();
  const fmt = (v) => formatDateTime(v, tz);
  const pointIds = points.map((p) => p._id);
  const pointById = new Map(points.map((p) => [p._id, p]));
  const records =
    type === "booth"
      ? pointIds.length
        ? db
            .prepare(`SELECT * FROM lead_booth_leads WHERE point_id IN (${pointIds.map(() => "?").join(",")}) ORDER BY point_id, last_visit_at DESC`)
            .all(...pointIds)
            .map(rowToLead)
        : []
      : visitsOf(pointIds);
  const personOf = contactsFor(eventId, records);
  const person = (r) => {
    const c = contact(personOf(r));
    return [c.name, c.email, c.mobile, c.organization, c.designation];
  };

  const name = [
    pointId ? slug(points[0].name) : type === "booth" ? "all-booths" : "all-rooms",
    ...(type === "room" ? [view] : []),
  ].join("-");
  const out = [];

  const writeEntryRows = () => {
    out.push(csvRow(["Room", "Name", "Email", "Mobile", "Organization", "Designation", "In Time", "Out Time", "Minutes", "Exit"]));
    for (const r of records) {
      const p = pointById.get(r.pointId);
      const minutes = r.outTime ? Math.round((r.outTime - r.inTime) / MINUTE_MS) : "";
      out.push(csvRow([
        p.name, ...person(r),
        fmt(r.inTime), fmt(r.outTime), minutes,
        r.status === "in" ? "Still in room" : EXIT_LABELS[r.outReason] || "",
      ]));
    }
  };

  if (type === "booth") {
    const timesOf = visitTimesBy(visitsOf(pointIds));
    out.push(csvRow(["Booth", "Exhibitor", "Name", "Email", "Mobile", "Organization", "Designation", "Rating", "Note", "Visits", "First Visit", "Last Visit", "All Visit Times"]));
    for (const r of records) {
      const p = pointById.get(r.pointId);
      const times = (timesOf.get(`${r.pointId}:${attendeeKey(r)}`) || []).map(fmt).join("; ");
      out.push(csvRow([p.name, p.exhibitorName, ...person(r), r.rating || "", r.note, r.visitCount, fmt(r.firstVisitAt), fmt(r.lastVisitAt), times]));
    }
  } else if (view === "entries") {
    writeEntryRows();
  } else {
    const sessions = sessionsOf(pointIds);
    if (!sessions.length) {
      writeEntryRows();
    } else {
      const now = Date.now();
      const visitsByRoom = new Map();
      for (const r of records) visitsByRoom.set(r.pointId, [...(visitsByRoom.get(r.pointId) || []), r]);
      const intervalsByRoom = new Map([...visitsByRoom].map(([roomId, list]) => [roomId, intervalsByAttendee(list, now)]));
      const firstVisitByKey = new Map();
      for (const r of records) if (!firstVisitByKey.has(attendeeKey(r))) firstVisitByKey.set(attendeeKey(r), r);

      // Their room entries that overlap the session: first in, and the last one's real out time
      const inOutFor = (roomId, key, s) => {
        const { start, end } = sessionWindow(s);
        const hits = (visitsByRoom.get(roomId) || []).filter(
          (v) => attendeeKey(v) === key && v.inTime.getTime() < end && visitEndMs(v, now) > start,
        );
        const last = hits.reduce((a, v) => (!a || v.inTime > a.inTime ? v : a), null);
        return [
          fmt(Math.min(...hits.map((v) => v.inTime.getTime()))),
          last.status === "in" ? "Still in room" : last.outTime ? fmt(last.outTime) : "No exit scan",
        ];
      };

      out.push(csvRow(["Room", "Session", "Speaker", "Scheduled Start", "Scheduled End", "Actual Start", "Actual End", "Times Used", "Name", "Email", "Mobile", "Organization", "Designation", "In Time", "Out Time", "Minutes in Session", "Attended"]));
      for (const s of sessions) {
        const p = pointById.get(s.roomId);
        for (const [key, own] of intervalsByRoom.get(s.roomId) || []) {
          const a = attendanceFor(own, s);
          if (!a.status) continue;
          out.push(csvRow([
            p.name, s.title, s.speaker, fmt(s.startTime), fmt(s.endTime),
            fmt(s.actualStartTime), fmt(s.actualEndTime), timesUsed(s),
            ...person(firstVisitByKey.get(key)), ...inOutFor(s.roomId, key, s), a.minutes,
            a.status === "attended" ? "Yes" : "Partial (under half)",
          ]));
        }
      }
    }
  }

  // BOM so Excel opens UTF-8 names correctly
  return { filename: `lead-capture-${name}.csv`, csv: "﻿" + out.join("") };
}

module.exports = { getPointReport, exportLeads, peakOccupancy };
