const router = require("express").Router();
const axios = require("axios");
const {
  upsertBadgeTemplates,
  getBadgeTemplates,
} = require("../database/badgeTemplates");
const settings = require("../settings");
const { CLOUD_BASE, CLOUD_HEADERS } = require("../config");

// GET /api/badge-templates — get locally stored templates
router.get("/", (_req, res) => {
  try {
    const eventId = settings.get("eventId") || null;
    const data = getBadgeTemplates(eventId);
    res.json({ status: 200, message: "Badge templates fetched", data });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// POST /api/badge-templates/pull — pull from cloud and store locally
router.post("/pull", async (_req, res) => {
  try {
    const eventId = settings.get("eventId");
    if (!eventId) {
      return res.status(401).json({ status: 401, message: "Not activated", logout: true });
    }

    const response = await axios.get(`${CLOUD_BASE}/badge-templates/${eventId}`, { headers: CLOUD_HEADERS });

    const templates = response.data.data || [];
    if (templates.length) upsertBadgeTemplates(templates);
    res.json({
      status: 200,
      message: `Pulled ${templates.length} badge templates`,
      data: templates,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

module.exports = router;
