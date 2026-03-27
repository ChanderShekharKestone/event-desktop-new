const router = require("express").Router();
const axios = require("axios");
const settings = require("../settings");
const {
  upsertRegistrationForms,
  getRegistrationForms,
  getRegistrationFormByAttendeeType,
} = require("../database/registrationForms");
const { getAttendeeTypes } = require("../database/attendeeTypes");
const { CLOUD_BASE, CLOUD_HEADERS } = require("../config");

// GET /api/registration-fields — load from local SQLite (survives refresh)
router.get("/", (_req, res) => {
  try {
    const eventId = settings.get("eventId") || null;
    const data = getRegistrationForms(eventId);
    res.json({ status: 200, message: "Registration forms fetched", data });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// GET /api/registration-fields/by-type/:attendeeTypeName
router.get("/by-type/:attendeeTypeName", (req, res) => {
  try {
    const eventId = settings.get("eventId") || null;
    const data = getRegistrationFormByAttendeeType(
      req.params.attendeeTypeName,
      eventId,
    );

    if (!data)
      return res.status(404).json({ status: 404, message: "Not found" });
    const attendeeTypes = getAttendeeTypes(eventId);
    res.json({ status: 200, message: "Registration form fetched", data: { ...data, attendeeTypes } });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// POST /api/registration-fields/pull — fetch from cloud and save to SQLite
router.post("/pull", async (_req, res) => {
  try {
    const eventId = settings.get("eventId");
    if (!eventId) {
      return res
        .status(401)
        .json({ status: 401, message: "Not activated", logout: true });
    }
    const { data } = await axios.get(
      `${CLOUD_BASE}/registration-fields/${eventId}`,
      { headers: CLOUD_HEADERS },
    );
    const forms = data.data || [];
    if (forms.length) upsertRegistrationForms(forms);
    res.json({
      status: 200,
      message: `Pulled ${forms.length} registration forms`,
      data: forms,
    });
  } catch (err) {
    const status = err.response?.status || 500;
    res
      .status(status)
      .json({ status, message: err.response?.data?.message || err.message });
  }
});

module.exports = router;
