const router = require("express").Router();
const { checkinById, checkinByEmail, searchDelegates, rowToObject } = require("../database/registrations");
const settings = require("../settings");

const toResponse = (row) => ({
  userInfo: rowToObject(row),
});

const send = (res, result) => {
  if (result.error) {
    const [status, message] = result.error;
    return res.status(status).json({ status, message, data: null });
  }
  res.json({ status: 200, message: "Checked in", data: toResponse(result.row) });
};

// POST /api/scan/checkin — body { id, allowReprint } with the raw badge QR text
// (uniqueUserId, cloud _id, or older '{"id":…}' badges) or a local id number.
// Already checked in → 409 unless allowReprint (the "Print again?" confirm).
router.post("/checkin", (req, res) => {
  try {
    const { id, checkedInTime, isPrintClicked, allowReprint } = req.body || {};
    const eventId = settings.get("eventId") || null;
    send(res, checkinById(id, { checkedInTime, isPrintClicked, allowReprint: allowReprint === true, eventId }));
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// POST /api/scan/search — check in by email (older kiosk screens; the scan page now
// uses GET /delegates + /checkin)
router.post("/search", (req, res) => {
  try {
    const { email, checkedInTime, isPrintClicked, allowReprint } = req.body || {};
    const eventId = settings.get("eventId") || null;
    send(res, checkinByEmail(email, { checkedInTime, isPrintClicked, allowReprint: allowReprint === true, eventId }));
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

// GET /api/scan/delegates?q=&limit= — "Search manually" list, email / mobile masked
router.get("/delegates", (req, res) => {
  try {
    const eventId = settings.get("eventId") || null;
    const data = searchDelegates(eventId, req.query.q, parseInt(req.query.limit) || 10);
    res.json({ status: 200, message: "Delegates found", data });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
});

module.exports = router;
