const router = require("express").Router();
const settings = require("../settings");
const {
  getFormHeadings,
  getFormHeading,
  upsertFormHeading,
} = require("../database/formHeadings");

// Local only — these are never pushed to cloud.

// GET /api/form-headings
router.get("/", (_req, res) => {
  try {
    const data = getFormHeadings(settings.get("eventId"));
    res.json({ status: 200, data });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// GET /api/form-headings/:type
router.get("/:type", (req, res) => {
  try {
    const data = getFormHeading(settings.get("eventId"), req.params.type);
    res.json({ status: 200, data: data || { type: req.params.type, heading: "", subheading: "", cssUrls: [] } });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// PUT /api/form-headings/:type
router.put("/:type", (req, res) => {
  try {
    const heading = String(req.body?.heading ?? "").trim();
    const subheading = String(req.body?.subheading ?? "").trim();
    const rawUrls = Array.isArray(req.body?.cssUrls) ? req.body.cssUrls : [];
    const cssUrls = rawUrls.map((u) => String(u).trim()).filter(Boolean);
    const bad = cssUrls.find((u) => !/^https?:\/\//i.test(u));
    if (bad) {
      return res.status(400).json({ status: 400, message: `CSS URL must start with http:// or https:// — ${bad}` });
    }
    const data = upsertFormHeading(settings.get("eventId"), req.params.type, { heading, subheading, cssUrls });
    res.json({ status: 200, message: "Heading saved", data });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

module.exports = router;
