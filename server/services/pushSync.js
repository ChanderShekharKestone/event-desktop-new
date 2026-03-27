const axios = require("axios");
const { getPending, removePending } = require("../database/pushPending");
const { db } = require("../db");
const { rowToObject, updateCloudId } = require("../database/registrations");
const settings = require("../settings");

const { CLOUD_BASE, CLOUD_HEADERS } = require("../config");

const API = `${CLOUD_BASE}/attendees`;

async function pushLocalChanges() {
  const eventId = settings.get("eventId");
  if (!eventId) {
    // console.log("Push sync skipped: not activated");
    return;
  }

  const pending = getPending(eventId);
  for (const item of pending) {
    try {
      const row = db
        .prepare("SELECT * FROM registrations WHERE id = ?")
        .get(item.registration_id);

      if (!row) {
        // Row deleted locally — nothing to push
        removePending(item.registration_id, eventId);
        continue;
      }

      const { _id, createdAt, updatedAt, cloudId, ...payload } =
        rowToObject(row);

      if (!row.cloudId) {
        // New local registration — POST to create on cloud
        console.log("[pushSync] POST new registration:", JSON.stringify({ ...payload, eventId: row.eventId }, null, 2));
        const response = await axios.post(
          API,
          { ...payload, eventId: row.eventId },
          { headers: CLOUD_HEADERS },
        );
        const newCloudId = response.data?.data?._id || response.data?._id;
        if (newCloudId) updateCloudId(item.registration_id, newCloudId);
      } else {
        // Existing registration — PUT to update
        console.log("[pushSync] PUT update registration:", row.cloudId, JSON.stringify(payload, null, 2));
        await axios.put(`${API}/${row.cloudId}`, payload, {
          headers: CLOUD_HEADERS,
        });
      }
      removePending(item.registration_id, eventId);
    } catch (err) {
      const detail = err.response?.data || err.message;
      throw new Error(
        typeof detail === "string" ? detail : JSON.stringify(detail),
      );
    }
  }
}

module.exports = { pushLocalChanges };

// ─── CLOUD API CODE (cut and paste into your cloud server) ───────────────────

// POST /api/attendees — create new attendee pushed from desktop
// router.post("/api/attendees", async (req, res) => {
//   try {
//     const {
//       firstName, lastName, email, mobile,
//       organization, designation, eventId, type,
//       isCheckedIn, checkedInTime, isPrintClicked,
//     } = req.body;
//     if (!eventId) return res.status(400).json({ status: 400, message: "eventId is required" });
//     if (!email)   return res.status(400).json({ status: 400, message: "email is required" });
//     const attendee = await Attendee.create({
//       firstName, lastName, email, mobile,
//       organization, designation, eventId, type,
//       isCheckedIn: isCheckedIn || false,
//       checkedInTime: checkedInTime || null,
//       isPrintClicked: isPrintClicked || false,
//     });
//     res.status(201).json({ status: 201, data: attendee });
//   } catch (err) {
//     const status = err.code === 11000 ? 409 : 500;
//     res.status(status).json({ status, message: err.message });
//   }
// });

// PUT /api/attendees/:id — update existing attendee (check-in, print status, etc.)
// router.put("/api/attendees/:id", async (req, res) => {
//   try {
//     const attendee = await Attendee.findByIdAndUpdate(
//       req.params.id,
//       { $set: { ...req.body, updatedAt: new Date() } },
//       { new: true, runValidators: true },
//     );
//     if (!attendee) return res.status(404).json({ status: 404, message: "Attendee not found" });
//     res.json({ status: 200, data: attendee });
//   } catch (err) {
//     res.status(500).json({ status: 500, message: err.message });
//   }
// });

// ─────────────────────────────────────────────────────────────────────────────
