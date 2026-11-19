// Agenda helpers shared by the admin pages and the scanner screens

const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export const fmtClock = (d) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export const fmtDay = (d) =>
  new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });

/** "09:00 – 09:30", with the day in front when it isn't today */
export const fmtRange = (s, now = Date.now()) =>
  `${sameDay(s.startTime, now) ? '' : `${fmtDay(s.startTime)}, `}${fmtClock(s.startTime)} – ${fmtClock(s.endTime)}`;

/** The session a volunteer has started on a scanner and nobody has ended yet */
export const runningSession = (agenda = []) =>
  agenda.find((s) => s.actualStartTime && !s.actualEndTime) || null;

/** The first session nobody has started yet */
export const nextNotStarted = (agenda = []) => agenda.find((s) => !s.actualStartTime) || null;

/** Where a session stands, for labels: running / ended / not started */
export const sessionState = (s) =>
  s.actualEndTime
    ? { key: 'ended', text: `Ran ${fmtClock(s.actualStartTime)} – ${fmtClock(s.actualEndTime)}` }
    : s.actualStartTime
      ? { key: 'running', text: `Started ${fmtClock(s.actualStartTime)}` }
      : { key: 'not-started', text: `Scheduled ${fmtRange(s)}` };

/** One line for a room: the running session, or the next one not started yet */
export const agendaStatus = (agenda = []) => {
  const cur = runningSession(agenda);
  if (cur) return { label: 'Now', session: cur, text: `${cur.title} · since ${fmtClock(cur.actualStartTime)}` };
  const next = nextNotStarted(agenda);
  if (next) return { label: 'Next', session: next, text: `${next.title} · scheduled ${fmtClock(next.startTime)}` };
  return null;
};

/** Sessions grouped by day, in order: [{ day: "Mon, 02 Nov", sessions: [...] }] */
export const groupByDay = (agenda = []) => {
  const groups = [];
  for (const s of agenda) {
    const day = fmtDay(s.startTime);
    if (groups.at(-1)?.day !== day) groups.push({ day, sessions: [] });
    groups.at(-1).sessions.push(s);
  }
  return groups;
};

// <input type="datetime-local"> value ↔ ISO, in the browser's time zone
export const toInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const fromInput = (v) => (v ? new Date(v).toISOString() : null);
