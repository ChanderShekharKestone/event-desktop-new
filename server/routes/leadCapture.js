// Lead capture admin — booths, rooms, agenda, scanner links, reports, CSV export.
// Not in LAN_ALLOWED (server/index.js), so only reachable from this PC.
// Same paths as the cloud's /api/v1/lead-capture, so the pages port unchanged.
const router = require("express").Router();
const settings = require("../settings");
const L = require("../database/leadCapture");
const { getPointReport, exportLeads } = require("../database/leadReport");

const requireEvent = (res) => {
  const eventId = settings.get("eventId");
  if (!eventId) res.status(401).json({ status: 401, message: "Not activated", logout: true });
  return eventId;
};

// Wraps a { data, message?, status? } | { error: [status, message] } result as JSON
const handle = (fn) => (req, res) => {
  try {
    const eventId = requireEvent(res);
    if (!eventId) return;
    const result = fn(eventId, req);
    if (result.error) {
      const [status, message] = result.error;
      return res.status(status).json({ status, message, data: null });
    }
    const status = result.status || 200;
    res.status(status).json({ status, message: result.message || "OK", data: result.data });
  } catch (err) {
    console.error("[lead-capture]", err);
    res.status(500).json({ status: 500, message: err.message, data: null });
  }
};

router.get("/points", handle((ev, req) => L.getPoints(ev, req.query.type)));
router.post("/points", handle((ev, req) => L.createPoint(ev, req.body || {})));
router.put("/points/:id", handle((ev, req) => L.updatePoint(ev, req.params.id, req.body || {})));
router.delete("/points/:id", handle((ev, req) => L.deletePoint(ev, req.params.id)));
router.post("/points/:id/link", handle((ev, req) => L.createLink(ev, req.params.id)));
router.delete("/points/:id/link", handle((ev, req) => L.deleteLink(ev, req.params.id)));
router.post("/points/:id/checkout", handle((ev, req) => L.checkoutRoom(ev, req.params.id, req.body?.attendeeId)));
router.post("/points/:id/agenda", handle((ev, req) => L.addSession(ev, req.params.id, req.body || {})));
router.put("/points/:id/agenda/:sessionId", handle((ev, req) => L.updateSession(ev, req.params.id, req.params.sessionId, req.body || {})));
router.delete("/points/:id/agenda/:sessionId", handle((ev, req) => L.deleteSession(ev, req.params.id, req.params.sessionId)));
router.get("/points/:id/screen", handle((ev, req) => L.getScreen(ev, req.params.id)));
router.put("/points/:id/screen", handle((ev, req) => L.updateScreen(ev, req.params.id, req.body || {})));
router.get("/points/:id/report", handle((ev, req) => getPointReport(ev, req.params.id)));
router.get("/link", handle((ev) => L.getEventLink(ev)));
router.post("/link", handle((ev) => L.createEventLink(ev)));
router.delete("/link", handle((ev) => L.deleteEventLink(ev)));
router.get("/live", handle((ev) => L.getLiveRooms(ev)));

// GET /api/lead-capture/export?type=booth|room&pointId=&view=attendance|entries
router.get("/export", (req, res) => {
  try {
    const eventId = requireEvent(res);
    if (!eventId) return;
    const result = exportLeads(eventId, req.query);
    if (result.error) {
      const [status, message] = result.error;
      return res.status(status).json({ status, message, data: null });
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    res.send(result.csv);
  } catch (err) {
    console.error("[lead-capture export]", err);
    res.status(500).json({ status: 500, message: "Failed to export", data: null });
  }
});

module.exports = router;
