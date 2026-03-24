const axios = require("axios");
const { insertManyFromCloud } = require("../database/sync");
const { getLastSync, updateLastSync } = require("../database/syncState");
const settings = require("../settings");
const { CLOUD_BASE, CLOUD_HEADERS } = require("../config");

const API = `${CLOUD_BASE}/attendees`;

async function syncFromCloud() {
  try {
    const eventId = settings.get("eventId");
    if (!eventId) return;

    const lastSync = getLastSync();
    const params = new URLSearchParams({ eventId });
    if (lastSync) params.set("updatedAfter", lastSync);

    const res = await axios.get(`${API}?${params.toString()}`, { headers: CLOUD_HEADERS });
    const users = res.data.data;

    if (users.length) {
      insertManyFromCloud(users);

      const newestTime = users.reduce(
        (max, u) => (!max || u.updatedAt > max ? u.updatedAt : max),
        lastSync,
      );
      if (newestTime) updateLastSync(newestTime);
    }
  } catch (err) {
    // console.error("Sync failed:", err.message);
  }
}

module.exports = { syncFromCloud };
