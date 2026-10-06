const router = require("express").Router();
const settings = require("../settings");
const {
  getGiveaways,
  getAttendees,
  assignGiveaway,
  revertGiveaway,
  clearFailedOps,
  getSyncStatus,
} = require("../database/giveaways");
const { syncGiveaways } = require("../services/giveawaySync");

const requireEvent = (res) => {
  const eventId = settings.get("eventId");
  if (!eventId) res.status(401).json({ status: 401, message: "Not activated", logout: true });
  return eventId;
};

// GET /api/giveaway — local giveaways with stock + sync status
router.get("/", (_req, res) => {
  try {
    const eventId = requireEvent(res);
    if (!eventId) return;
    res.json({
      status: 200,
      message: "Giveaways fetched",
      data: { giveaways: getGiveaways(eventId), sync: getSyncStatus(eventId) },
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// GET /api/giveaway/attendees?page=&limit=&q=
router.get("/attendees", (req, res) => {
  try {
    const eventId = requireEvent(res);
    if (!eventId) return;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const data = getAttendees(eventId, { page, limit, q: String(req.query.q || "") });
    res.json({ status: 200, message: "Delegates fetched", data });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// POST /api/giveaway/assign | /revert — body { giveawayId, email }. Saved locally, pushed later.
const handle = (fn, okMessage) => (req, res) => {
  try {
    const eventId = requireEvent(res);
    if (!eventId) return;
    const { giveawayId, email } = req.body || {};
    if (!giveawayId || !email) {
      return res.status(400).json({ status: 400, message: "giveawayId and email are required", data: null });
    }
    const result = fn(eventId, String(giveawayId), String(email));
    if (result.error) {
      const [status, message] = result.error;
      return res.status(status).json({ status, message, data: null });
    }
    res.json({ status: 200, message: okMessage, data: result.giveaway });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
};
router.post("/assign", handle(assignGiveaway, "Giveaway assigned"));
router.post("/revert", handle(revertGiveaway, "Giveaway reverted"));

// POST /api/giveaway/sync — push queued assign/revert, then pull the cloud giveaways.
// 502 when the cloud can't be reached; local data stays as it is.
router.post("/sync", async (_req, res) => {
  try {
    const eventId = requireEvent(res);
    if (!eventId) return;
    const data = await syncGiveaways();
    res.json({ status: 200, message: "Giveaways synced", data });
  } catch (err) {
    res.status(502).json({ status: 502, message: err.message || "Cloud sync failed", data: null });
  }
});

// DELETE /api/giveaway/failed — dismiss changes the cloud rejected
router.delete("/failed", (_req, res) => {
  try {
    const eventId = requireEvent(res);
    if (!eventId) return;
    clearFailedOps(eventId);
    res.json({ status: 200, message: "Cleared", data: null });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

module.exports = router;
