// Lead capture scanner screens — opened on phones / tablets on the LAN from a link made in
// Lead Capture. No login: the link token is the access key (like the cloud's public routes).
//   /api/public/lead/:token                       — one booth / room
//   /api/public/lead-event/:token                 — universal link: list to pick from
//   /api/public/lead-event/:token/points/:pointId — universal link, picked booth / room
// Each scanner base supports GET (screen info), POST /scan, /session, /rate.
const express = require("express");
const settings = require("../settings");
const L = require("../database/leadCapture");

const send = (res, result) => {
  if (result.error) {
    const [status, message] = result.error;
    return res.status(status).json({ status, message, data: null });
  }
  res.json({ status: 200, message: result.message || "OK", data: result.data });
};

const safe = (fn) => (req, res, next) => {
  try {
    fn(req, res, next);
  } catch (err) {
    console.error("[lead scanner]", err);
    res.status(500).json({ status: 500, message: "Failed to record scan", data: null });
  }
};

// req.leadPoint is set by the auth step in front of these
const scannerRoutes = () => {
  const r = express.Router({ mergeParams: true });
  r.get("/", safe((req, res) => send(res, L.getScannerInfo(req.leadPoint))));
  r.post("/scan", safe((req, res) => send(res, L.scanAtPoint(req.leadPoint, req.body))));
  r.post("/session", safe((req, res) => send(res, L.startSession(req.leadPoint, req.body?.sessionId))));
  r.post("/rate", safe((req, res) => send(res, L.rateLead(req.leadPoint, req.body))));
  return r;
};

const leadAuth = safe((req, res, next) => {
  const found = L.pointByToken(req.params.token);
  if (found.error) return send(res, found);
  req.leadPoint = found.point;
  next();
});

const eventLinkAuth = safe((req, res, next) => {
  const found = L.eventLinkByToken(req.params.token);
  if (found.error) return send(res, found);
  req.leadLink = found.link;
  next();
});

const eventPointAuth = safe((req, res, next) => {
  const found = L.pointForEventLink(req.leadLink, req.params.pointId);
  if (found.error) return send(res, found);
  req.leadPoint = found.point;
  next();
});

const router = express.Router();
router.use("/lead/:token", leadAuth, scannerRoutes());
router.get(
  "/lead-event/:token",
  eventLinkAuth,
  safe((req, res) => send(res, L.getEventScannerInfo(req.leadLink, settings.get("eventName")))),
);
router.use("/lead-event/:token/points/:pointId", eventLinkAuth, eventPointAuth, scannerRoutes());

module.exports = router;
