const { db } = require("../db");

function getAllSdkConfigs() {
  return db.prepare("SELECT * FROM sdk_configs ORDER BY id DESC").all().map(rowToObject);
}

function getSdkConfigById(id) {
  const row = db.prepare("SELECT * FROM sdk_configs WHERE id = ?").get(id);
  return row ? rowToObject(row) : null;
}

function insertSdkConfig({ name, sdkCloudPath, sdkLocalPath, type }) {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO sdk_configs (name, sdk_cloud_path, sdk_local_path, type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(name, sdkCloudPath, sdkLocalPath || "", type, now, now);
  return getSdkConfigById(result.lastInsertRowid);
}

function updateSdkConfig(id, { name, sdkCloudPath, sdkLocalPath, type }) {
  const now = new Date().toISOString();
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push("name = ?"); values.push(name); }
  if (sdkCloudPath !== undefined) { fields.push("sdk_cloud_path = ?"); values.push(sdkCloudPath); }
  if (sdkLocalPath !== undefined) { fields.push("sdk_local_path = ?"); values.push(sdkLocalPath); }
  if (type !== undefined) { fields.push("type = ?"); values.push(type); }

  if (!fields.length) return getSdkConfigById(id);

  fields.push("updated_at = ?");
  values.push(now, id);

  db.prepare(`UPDATE sdk_configs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getSdkConfigById(id);
}

function deleteSdkConfig(id) {
  const row = getSdkConfigById(id);
  if (!row) return null;
  db.prepare("DELETE FROM sdk_configs WHERE id = ?").run(id);
  return row;
}

function deleteAllSdkConfigs() {
  return db.prepare("DELETE FROM sdk_configs").run().changes;
}

function rowToObject(r) {
  return {
    _id: r.id,
    name: r.name,
    sdkCloudPath: r.sdk_cloud_path,
    sdkLocalPath: r.sdk_local_path || "",
    type: r.type,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

module.exports = { getAllSdkConfigs, getSdkConfigById, insertSdkConfig, updateSdkConfig, deleteSdkConfig, deleteAllSdkConfigs };
