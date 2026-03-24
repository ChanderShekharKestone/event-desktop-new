const router = require("express").Router();
const axios = require("axios");
const {
  upsertAttendeeTypes,
  getAttendeeTypes,
} = require("../database/attendeeTypes");
const settings = require("../settings");
const { CLOUD_BASE, CLOUD_HEADERS } = require("../config");

// GET /api/attendee-types — get locally stored types
router.get("/", (_req, res) => {
  try {
    const eventId = settings.get("eventId") || null;
    const data = getAttendeeTypes(eventId);
    res.json({ status: 200, message: "AttendeeTypes fetched", data });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// POST /api/attendee-types/pull — pull from cloud and store locally
router.post("/pull", async (_req, res) => {
  try {
    const eventId = settings.get("eventId");
    if (!eventId) {
      return res.status(401).json({ status: 401, message: "Not activated", logout: true });
    }

    const response = await axios.get(`${CLOUD_BASE}/attendee-types/${eventId}`, { headers: CLOUD_HEADERS });
    const types = response.data.data || [];

    if (types.length) upsertAttendeeTypes(types);
    res.json({
      status: 200,
      message: `Pulled ${types.length} attendee types`,
      data: types,
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

module.exports = router;
