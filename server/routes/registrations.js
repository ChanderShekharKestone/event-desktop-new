const router = require("express").Router();
const {
  insertRegistration,
  updateRegistration,
  getRegistrationsPaginated,
} = require("../database/registrations");
const { db } = require("../db");
const settings = require("../settings");

// POST /api/registrations - save registration
router.post("/", (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobile,
      organization,
      designation,
      eventId,
      campaignSource,
      customfields,
      avatarUrl,
      type,
      attendeeType,
      moderator,
      customerId,
      termsAndCondn,
      areaOfInterest,
    } = req.body;
    if (!firstName || !email) {
      return res.status(400).json({
        status: 400,
        message: "First name and email are required",
        data: null,
      });
    }

    let roleType;

    if (attendeeType === "exhibitor") {
      roleType = "vos68";
    } else if (attendeeType === "speaker") {
      roleType = "vos58";
    } else if (attendeeType === "moderator") {
      roleType = "vos82";
    } else {
      roleType = "vos78";
    }

    const newUser = insertRegistration({
      firstName,
      lastName,
      email,
      mobile,
      organization,
      designation,
      eventId: eventId || settings.get("eventId") || null,
      campaignSource: campaignSource || null,
      roleId: roleType,
      customfields: customfields || null,
      avatarUrl: avatarUrl || "https://cdn.vosmos.live/VEP/assests/dummy.png",
      type:
        attendeeType === "partner"
          ? "mob011"
          : attendeeType === "sponsor"
            ? "mob001"
            : type || attendeeType || "attendee",
      moderator: moderator ? 1 : 0,
      customerId: customerId || settings.get("customerId") || null,
      termsAndCondn: termsAndCondn ? 1 : 0,
      areaOfInterest: areaOfInterest || [],
    });
    res.json({
      status: 200,
      message: "Registration saved successfully",
      data: newUser,
    });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return res
        .status(400)
        .json({ status: 400, message: "Email already registered", data: null });
    }
    res.status(500).json({
      status: 500,
      message: error.message || "Internal error",
      data: null,
    });
  }
});

// PUT /api/registrations/:id - update registration fields
router.put("/:id", (req, res) => {
  try {
    const updated = updateRegistration(parseInt(req.params.id), req.body);
    if (!updated)
      return res
        .status(404)
        .json({ status: 404, message: "Registration not found", data: null });
    res.json({ status: 200, message: "Registration updated", data: updated });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// GET /api/registrations/stats
router.get("/stats", (_req, res) => {
  try {
    const eventId = settings.get("eventId") || null;
    const where = eventId ? "WHERE eventId = ?" : "";
    const params = eventId ? [eventId] : [];

    const total = db
      .prepare(`SELECT COUNT(*) as c FROM registrations ${where}`)
      .get(params).c;
    const checkedIn = db
      .prepare(
        `SELECT COUNT(*) as c FROM registrations ${where ? where + " AND" : "WHERE"} isCheckedIn = 1`,
      )
      .get(params).c;

    const byType = db
      .prepare(
        `SELECT type, COUNT(*) as total, SUM(isCheckedIn) as checkedIn FROM registrations ${where} GROUP BY type ORDER BY total DESC`,
      )
      .all(params);

    res.json({
      status: 200,
      data: {
        total,
        checkedIn,
        notCheckedIn: total - checkedIn,
        checkInRate: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
        byType: byType.map((r) => ({
          type: r.type || "attendee",
          total: r.total,
          checkedIn: r.checkedIn || 0,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// GET /api/registrations - paginated
router.get("/", (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = "",
      sort = "createdAt",
      order = "desc",
      type = "",
    } = req.query;
    const eventId = settings.get("eventId") || null;
    const result = getRegistrationsPaginated({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      sort,
      order,
      eventId,
      type,
    });
    res.json({
      status: 200,
      message: "Registrations fetched",
      data: result.data,
      total: result.total,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: error.message || "Internal error",
      data: null,
    });
  }
});

module.exports = router;
