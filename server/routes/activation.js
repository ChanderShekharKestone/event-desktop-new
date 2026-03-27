const router = require("express").Router();
const crypto = require("crypto");
const axios = require("axios");

const { machineId } = require("node-machine-id");
const settings = require("../settings");
const { db } = require("../db");
const { CLOUD_BASE, CLOUD_HEADERS } = require("../config");
const { syncFromCloud } = require("../services/cloudSync");
const { clearSyncState } = require("../database/syncState");

async function getMachineId() {
  const rawId = await machineId(true); // true = raw (un-hashed) hardware ID
  return crypto
    .createHash("sha256")
    .update(rawId)
    .digest("hex")
    .substring(0, 12)
    .toUpperCase()
    .match(/.{1,4}/g)
    .join("-");
}

function saveEventId(eventId) {
  const exists = db.prepare(`SELECT 1 FROM app_settings WHERE key = 'eventId'`).get();
  if (exists) {
    db.prepare(`UPDATE app_settings SET value = ? WHERE key = 'eventId'`).run(String(eventId));
  } else {
    db.prepare(`INSERT INTO app_settings (key, value) VALUES ('eventId', ?)`).run(String(eventId));
  }
}

// GET /api/activation — check status
router.get("/", (_req, res) => {
  try {
    const activated = settings.get("activated") || false;
    if (!activated) {
      return res.json({ status: 200, data: { activated: false } });
    }

    const expiresAt = settings.get("expiresAt");
    const isExpired = !expiresAt || new Date(expiresAt) < new Date();

    if (isExpired) {
      settings.del("activated");
      settings.del("eventId");
      settings.del("expiresAt");
      return res.json({
        status: 200,
        data: { activated: false, reason: "expired" },
      });
    }

    res.json({
      status: 200,
      data: {
        activated: true,
        eventId: settings.get("eventId"),
        expiresAt,
      },
    });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// POST /api/activation — activate with key, calls cloud API
router.post("/", async (req, res) => {
  try {
    const { activationKey } = req.body;
    if (!activationKey) {
      return res
        .status(400)
        .json({ status: 400, message: "activationKey is required" });
    }

    const machineId = await getMachineId();

    const cloudRes = await axios.post(
      `${CLOUD_BASE}/activation/verify`,
      { activationKey, machineId },
      { headers: CLOUD_HEADERS },
    );

    const { eventId, expiresAt } = cloudRes.data.data;

    // If switching to a different event, clear old event's sync state
    const prevEventId = settings.get("eventId");
    if (prevEventId && prevEventId !== String(eventId)) {
      clearSyncState(prevEventId);
    }

    settings.set("activated", true);
    settings.set("eventId", String(eventId));
    settings.set("expiresAt", expiresAt);
    saveEventId(eventId);
    await syncFromCloud().catch(() => {});

    res.json({
      status: 200,
      message: "Activated successfully",
      data: { activated: true, eventId: String(eventId), expiresAt },
    });
  } catch (err) {
    const cloudMsg = err.response?.data?.message || err.message;
    const code = err.response?.status || 500;
    res.status(code).json({ status: code, message: cloudMsg });
  }
});

// DELETE /api/activation — reset activation
router.delete("/", (_req, res) => {
  const eventId = settings.get("eventId");
  if (eventId) clearSyncState(eventId);
  settings.del("activated");
  settings.del("eventId");
  settings.del("expiresAt");
  saveEventId("");
  res.json({ status: 200, message: "Activation reset", data: false });
});

// GET /api/machine-id
router.get("/machine-id", async (_req, res) => {
  try {
    res.json({ status: 200, message: "OK", data: await getMachineId() });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to get machine ID",
      error: err.message,
      stack: err.stack,
      platform: process.platform,
      data: null,
    });
  }
});

module.exports = router;
