const axios = require("axios");
const { insertManyFromCloud, setUniqueUserIds } = require("../database/sync");
const { getLastSync, updateLastSync } = require("../database/syncState");
const settings = require("../settings");
const { db } = require("../db");
const { CLOUD_BASE, CLOUD_HEADERS } = require("../config");

const API = `${CLOUD_BASE}/attendees`;

async function syncFromCloud() {
  try {
    const eventId = settings.get("eventId");
    if (!eventId) return;

    const localCount = db
      .prepare("SELECT COUNT(*) as count FROM registrations WHERE eventId = ?")
      .get(eventId).count;
    const lastSync = localCount > 0 ? getLastSync(eventId) : null;
    const params = new URLSearchParams({ eventId });
    if (lastSync) params.set("updatedAfter", lastSync);

    const res = await axios.get(`${API}?${params.toString()}`, {
      headers: CLOUD_HEADERS,
    });
    const users = res.data.data;
    console.log(users.length, "length");
    if (users.length) {
      insertManyFromCloud(users);

      const newestTime = users.reduce(
        (max, u) => (!max || u.updatedAt > max ? u.updatedAt : max),
        lastSync,
      );
      if (newestTime) updateLastSync(newestTime, eventId);
    }

    // A full pull (no updatedAfter) already brought uniqueUserId for every row
    if (!lastSync) settings.set(BACKFILL_KEY, eventId);
    else await backfillUniqueUserIds(eventId);
  } catch (err) {
    // console.error("syncFromCloud error:", err.message);
  }
}

// Rows pulled before the uniqueUserId column existed never get it from the
// incremental pull (updatedAfter), so fetch the full list once per event and
// set only that column. Not a full re-pull: INSERT OR REPLACE would replace the
// rows, changing local ids and losing un-pushed check-ins.
const BACKFILL_KEY = "uniqueUserIdBackfilledFor";

async function backfillUniqueUserIds(eventId) {
  if (settings.get(BACKFILL_KEY) === eventId) return;
  const res = await axios.get(`${API}?${new URLSearchParams({ eventId })}`, {
    headers: CLOUD_HEADERS,
  });
  const users = res.data?.data;
  if (!Array.isArray(users)) return;
  setUniqueUserIds(eventId, users);
  settings.set(BACKFILL_KEY, eventId);
}

module.exports = { syncFromCloud };
