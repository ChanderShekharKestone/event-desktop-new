// Day boundaries in an event's time zone (IANA name, e.g. "Asia/Kolkata").
// Copied from the diy-ui api (utils/timezone.js); eventTimeZone() is desktop-only.
const settings = require("../settings");

/** The event's zone when Intl knows it, otherwise UTC — a bad value must never break scanning */
const safeTimeZone = (timeZone) => {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
};

/** How far the zone's wall clock is ahead of UTC at `ms`, in ms */
const offsetAt = (ms, timeZone) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - (ms - (ms % 1000));
};

/** UTC instant of local midnight for the local date y-m-d (m is 0-based) */
const localMidnight = (y, m, d, timeZone) => {
  const guess = Date.UTC(y, m, d);
  // Two passes settle DST changes that happen near midnight
  let t = guess - offsetAt(guess, timeZone);
  t = guess - offsetAt(t, timeZone);
  return t;
};

/** { start, end } of the local day containing `date` in the event's zone */
const dayBounds = (date, timeZone) => {
  const tz = safeTimeZone(timeZone);
  const ms = new Date(date).getTime();
  const local = new Date(ms + offsetAt(ms, tz));
  const [y, m, d] = [local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()];
  return { start: new Date(localMidnight(y, m, d, tz)), end: new Date(localMidnight(y, m, d + 1, tz)) };
};

/** "dd-mm-yyyy HH:MM" in the event's zone — the format used across exported reports */
const formatDateTime = (value, timeZone) => {
  if (!value) return "";
  const tz = safeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}`;
};

/**
 * The event's time zone: saved by the cloud sync when known ("eventTimeZone"),
 * otherwise this PC's own zone — the desktop usually sits at the event.
 */
const eventTimeZone = () =>
  safeTimeZone(settings.get("eventTimeZone") || Intl.DateTimeFormat().resolvedOptions().timeZone);

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csvRow = (cells) => cells.map(csvCell).join(",") + "\n";

module.exports = { safeTimeZone, dayBounds, formatDateTime, eventTimeZone, csvRow };
