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
        console.log(
          "[pushSync] POST new registration:",
          JSON.stringify({ ...payload, eventId: row.eventId }, null, 2),
        );
        const response = await axios.post(
          API,
          { ...payload, eventId: row.eventId },
          { headers: CLOUD_HEADERS },
        );
        const newCloudId = response.data?.data?._id || response.data?._id;
        if (newCloudId) updateCloudId(item.registration_id, newCloudId);
      } else {
        // Existing registration — PUT to update
        console.log(
          "[pushSync] PUT update registration:",
          row.cloudId,
          JSON.stringify(payload, null, 2),
        );
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
