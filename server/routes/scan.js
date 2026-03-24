const router = require("express").Router();
const { checkinById, checkinByEmail, rowToObject } = require("../database/registrations");
const settings = require("../settings");

const toResponse = (row) => ({
  userInfo: rowToObject(row),
});

// POST /api/scan/checkin — scan by cloud_id (MongoDB _id from QR code)
router.post("/checkin", (req, res) => {
  try {
    const { id, checkedInTime, isPrintClicked } = req.body;
    const eventId = settings.get("eventId") || null;
    // console.log("[scan/checkin] id:", id);
    const row = checkinById(id, { checkedInTime, isPrintClicked, eventId });
    // console.log("[scan/checkin] found:", row ? row.email : "NOT FOUND");
    if (!row) return res.status(404).json({ status: 404, message: "User not found", data: null });
    res.json({ status: 200, message: "Checked in", data: toResponse(row) });
  } catch (err) {
    // console.error("[scan/checkin] error:", err.message);
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// POST /api/scan/search — search & check in by email
router.post("/search", (req, res) => {
  try {
    const { email, checkedInTime, isPrintClicked } = req.body;
    const eventId = settings.get("eventId") || null;
    // console.log("[scan/search] email:", email);
    const row = checkinByEmail(email, { checkedInTime, isPrintClicked, eventId });
    // console.log("[scan/search] found:", row ? row.email : "NOT FOUND");
    if (!row) return res.status(404).json({ status: 404, message: "User not found", data: null });
    res.json({ status: 200, message: "Checked in", data: toResponse(row) });
  } catch (err) {
    // console.error("[scan/search] error:", err.message);
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

module.exports = router;
