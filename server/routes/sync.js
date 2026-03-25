const router = require("express").Router();
const { syncFromCloud } = require("../services/cloudSync");
const { pushLocalChanges } = require("../services/pushSync");
const { getPendingCount } = require("../database/pushPending");
const settings = require("../settings");

// POST /api/sync/pull - sync from cloud
router.post("/pull", async (_req, res) => {
  try {
    await syncFromCloud();
    res.json({
      status: 200,
      message: "Sync completed successfully",
      data: null,
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Sync failed", data: null });
  }
});

// POST /api/sync/push - push local changes to cloud
router.post("/push", async (_req, res) => {
  try {
    await pushLocalChanges();
    res.json({ status: 200, message: "Push completed", data: null });
  } catch (error) {
    res.status(500).json({ status: 500, message: error.message || "Push failed", data: null });
  }
});

// GET /api/sync/pending-count - count of unsynced local changes
router.get("/pending-count", (_req, res) => {
  try {
    const eventId = settings.get("eventId") || "";
    const count = getPendingCount(eventId);
    res.json({
      status: 200,
      message: "Pending count fetched",
      data: { count },
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

module.exports = router;
