const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const {
  getAllSdkConfigs,
  getSdkConfigById,
  insertSdkConfig,
  updateSdkConfig,
  deleteSdkConfig,
  deleteAllSdkConfigs,
} = require("../database/sdkConfigs");
const settings = require("../settings");

const SDK_FILES_DIR = process.env.USER_DATA_PATH
  ? path.join(process.env.USER_DATA_PATH, "sdk-files")
  : path.join(__dirname, "../../sdk-files");

if (!fs.existsSync(SDK_FILES_DIR)) {
  fs.mkdirSync(SDK_FILES_DIR, { recursive: true });
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    proto
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
  });
}

// Normalize sdkLocalPath to current SDK_FILES_DIR and check file exists
function resolveLocalPath(config) {
  if (!config.sdkLocalPath) return config;
  const basename = path.basename(config.sdkLocalPath);
  const resolved = path.join(SDK_FILES_DIR, basename);
  return { ...config, sdkLocalPath: fs.existsSync(resolved) ? resolved : "" };
}

// GET /api/sdk-configs
router.get("/", (_req, res) => {
  try {
    const data = getAllSdkConfigs().map(resolveLocalPath);
    res.json({ status: 200, data });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// GET /api/sdk-configs/:id
router.get("/:id", (req, res) => {
  try {
    const item = getSdkConfigById(parseInt(req.params.id));
    if (!item) return res.status(404).json({ status: 404, message: "Not found" });
    res.json({ status: 200, data: item });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// POST /api/sdk-configs - create and download SDK file
router.post("/", async (req, res) => {
  try {
    const { name, sdkCloudPath, type } = req.body;
    if (!name || !sdkCloudPath || !type) {
      return res.status(400).json({ status: 400, message: "name, sdkCloudPath and type are required" });
    }

    const eventId = settings.get("eventId") || "event";
    const fileName = `${slugify(String(eventId))}-${slugify(type)}.js`;
    const localPath = path.join(SDK_FILES_DIR, fileName);

    await downloadFile(sdkCloudPath, localPath);

    const record = insertSdkConfig({ name, sdkCloudPath, sdkLocalPath: localPath, type });
    res.status(201).json({ status: 201, message: "SDK config created", data: record });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// PUT /api/sdk-configs/:id - update (re-downloads if sdkCloudPath changes)
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = getSdkConfigById(id);
    if (!existing) return res.status(404).json({ status: 404, message: "Not found" });

    const { name, sdkCloudPath, type } = req.body;
    let sdkLocalPath = existing.sdkLocalPath;

    const newName = name || existing.name;
    const newType = type || existing.type;
    const newCloudPath = sdkCloudPath || existing.sdkCloudPath;

    // Re-download if cloud path or name/type changed (affects filename)
    if (sdkCloudPath || name || type) {
      const eventId = settings.get("eventId") || "event";
      const fileName = `${slugify(String(eventId))}-${slugify(newType)}.js`;
      const localPath = path.join(SDK_FILES_DIR, fileName);
      await downloadFile(newCloudPath, localPath);
      sdkLocalPath = localPath;
    }

    const updated = updateSdkConfig(id, {
      name: newName,
      sdkCloudPath: newCloudPath,
      sdkLocalPath,
      type: newType,
    });
    res.json({ status: 200, message: "SDK config updated", data: updated });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// DELETE /api/sdk-configs - remove all configs and every file in sdk-files (incl. leftovers from old events)
router.delete("/", (_req, res) => {
  try {
    const configs = deleteAllSdkConfigs();
    let files = 0;
    for (const name of fs.readdirSync(SDK_FILES_DIR)) {
      if (!name.endsWith(".js")) continue;
      fs.unlinkSync(path.join(SDK_FILES_DIR, name));
      files++;
    }
    res.json({ status: 200, message: `Deleted ${configs} config(s) and ${files} file(s)`, data: { configs, files } });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

// DELETE /api/sdk-configs/:id
router.delete("/:id", (req, res) => {
  try {
    const deleted = deleteSdkConfig(parseInt(req.params.id));
    if (!deleted) return res.status(404).json({ status: 404, message: "Not found" });

    // Remove local file if it exists
    if (deleted.sdkLocalPath && fs.existsSync(deleted.sdkLocalPath)) {
      fs.unlinkSync(deleted.sdkLocalPath);
    }

    res.json({ status: 200, message: "SDK config deleted" });
  } catch (err) {
    res.status(500).json({ status: 500, message: err.message });
  }
});

module.exports = router;
