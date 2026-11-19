// Copied from the diy-ui api (utils/attendance.js) — keep in sync.
// Who attended which agenda session — worked out from room in/out times

const MINUTE_MS = 60 * 1000;
const ATTEND_SHARE = 0.5; // in the room for at least half the session = attended

const ms = (d) => new Date(d).getTime();

/**
 * When a session really ran. Started on a scanner → actual start; it ends when the next
 * session is started (actual end), else after its scheduled length. Never started → schedule.
 */
const sessionWindow = (s) => {
  const scheduledLength = ms(s.endTime) - ms(s.startTime);
  if (!s.actualStartTime) return { start: ms(s.startTime), end: ms(s.endTime) };
  const start = ms(s.actualStartTime);
  return { start, end: s.actualEndTime ? ms(s.actualEndTime) : start + scheduledLength };
};

/** "upcoming" | "live" | "ended" — live only once a volunteer has started it */
const sessionStatus = (s, now) => {
  if (s.actualEndTime) return "ended";
  if (s.actualStartTime) return "live";
  return now < ms(s.endTime) ? "upcoming" : "ended";
};

/**
 * Where a room visit's time stops counting. A real out time when there is one; with no exit
 * scan they count as present until the room's agenda ends that day (autoCloseAt) — never
 * past now while they're still in. Nothing here is stored as an out time.
 */
const visitEndMs = (v, now) => {
  if (v.outTime) return ms(v.outTime);
  const until = v.autoCloseAt ? ms(v.autoCloseAt) : null;
  if (v.status === "in") return until ? Math.min(now, until) : now;
  return until ?? ms(v.inTime);
};

/** Minutes of [start, end) covered by the intervals ([inMs, outMs] pairs, may overlap) */
const overlapMinutes = (intervals, start, end) => {
  const clipped = intervals
    .map(([i, o]) => [Math.max(i, start), Math.min(o, end)])
    .filter(([i, o]) => o > i)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = null;
  let curEnd = null;
  for (const [i, o] of clipped) {
    if (curEnd === null || i > curEnd) {
      if (curEnd !== null) total += curEnd - curStart;
      [curStart, curEnd] = [i, o];
    } else curEnd = Math.max(curEnd, o);
  }
  if (curEnd !== null) total += curEnd - curStart;
  return total / MINUTE_MS;
};

/** "attended" | "partial" (some time, under half) | null (never there) for one session */
const attendanceFor = (intervals, session) => {
  const { start, end } = sessionWindow(session);
  const minutes = overlapMinutes(intervals, start, end);
  if (minutes <= 0) return { status: null, minutes: 0 };
  const needed = ((end - start) / MINUTE_MS) * ATTEND_SHARE;
  return { status: minutes >= needed ? "attended" : "partial", minutes: Math.round(minutes) };
};

module.exports = { sessionWindow, sessionStatus, visitEndMs, overlapMinutes, attendanceFor, ATTEND_SHARE };
