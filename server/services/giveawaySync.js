const axios = require("axios");
const settings = require("../settings");
const { CLOUD_BASE, CLOUD_HEADERS } = require("../config");
const {
  findRegistration,
  replaceFromCloud,
  getOps,
  removeOp,
  failOp,
} = require("../database/giveaways");

// Cloud offline API (no login, eventId in path / body):
//   GET  /giveaway/:eventId  → giveaways with assignedTo[]
//   POST /giveaway/assign    { eventId, giveawayId, attendeeId }
//   POST /giveaway/revert    { eventId, giveawayId, attendeeId }
const API = `${CLOUD_BASE}/giveaway`;

let running = null;

async function pullGiveaways(eventId = settings.get("eventId")) {
  if (!eventId) return 0;
  const res = await axios.get(`${API}/${eventId}`, { headers: CLOUD_HEADERS });
  const list = res.data?.data;
  if (!Array.isArray(list)) throw new Error("Unexpected giveaway response from cloud");
  replaceFromCloud(eventId, list);
  return list.length;
}

// Push queued ops in order. Ops for a delegate not on the cloud yet stay queued
// until the registration push gives it a cloudId.
async function pushGiveaways(eventId = settings.get("eventId")) {
  if (!eventId) return 0;
  let pushed = 0;
  for (const op of getOps(eventId, "pending")) {
    const cloudId = findRegistration(eventId, op.email)?.cloudId;
    if (!cloudId) continue;
    let res;
    try {
      res = await axios.post(
        `${API}/${op.action}`,
        { eventId, giveawayId: op.giveaway_id, attendeeId: cloudId },
        { headers: CLOUD_HEADERS },
      );
    } catch (err) {
      const status = err.response?.status;
      if (!status) throw err; // offline / cloud down — keep everything queued
      if (status === 409) {
        // Already assigned / already reverted on the cloud — the goal is reached
        removeOp(op.id);
      } else {
        failOp(op.id, err.response?.data?.message || `Cloud error ${status}`);
      }
      continue;
    }
    // A 200 without the updated giveaway is not a real giveaway endpoint — keep the op
    if (!res.data?.data?._id) throw new Error("Cloud giveaway API not available — changes kept locally");
    removeOp(op.id);
    pushed++;
  }
  return pushed;
}

/** Push local assign/revert, then pull the cloud state. One run at a time. */
function syncGiveaways() {
  if (running) return running;
  running = (async () => {
    const eventId = settings.get("eventId");
    if (!eventId) return { pushed: 0, pulled: 0 };
    const pushed = await pushGiveaways(eventId);
    const pulled = await pullGiveaways(eventId);
    return { pushed, pulled };
  })().finally(() => {
    running = null;
  });
  return running;
}

module.exports = { syncGiveaways, pushGiveaways, pullGiveaways };
