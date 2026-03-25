const axios = require("axios");
const { insertManyFromCloud } = require("../database/sync");
const { getLastSync, updateLastSync } = require("../database/syncState");
const settings = require("../settings");
const { db } = require("../db");
const { CLOUD_BASE, CLOUD_HEADERS } = require("../config");

const API = `${CLOUD_BASE}/attendees`;

async function syncFromCloud() {
  try {
    const eventId = settings.get("eventId");
    if (!eventId) return;

    const localCount = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE eventId = ?").get(eventId).count;
    const lastSync = localCount > 0 ? getLastSync(eventId) : null;
    const params = new URLSearchParams({ eventId });
    if (lastSync) params.set("updatedAfter", lastSync);

    const res = await axios.get(`${API}?${params.toString()}`, {
      headers: CLOUD_HEADERS,
    });
    const users = res.data.data;

    if (users.length) {
      insertManyFromCloud(users);

      const newestTime = users.reduce(
        (max, u) => (!max || u.updatedAt > max ? u.updatedAt : max),
        lastSync,
      );
      if (newestTime) updateLastSync(newestTime, eventId);
    }
  } catch (err) {
    // console.error("syncFromCloud error:", err.message);
  }
}

module.exports = { syncFromCloud };
