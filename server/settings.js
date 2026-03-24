const path = require("path");
const fs = require("fs");

const userDataPath = process.env.USER_DATA_PATH;

const settingsPath =
  process.env.SETTINGS_PATH ||
  (userDataPath
    ? path.join(userDataPath, "settings.json")
    : path.join(__dirname, "../electron/settings.json"));

function get(key) {
  try {
    const data = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    return data[key];
  } catch {
    return undefined;
  }
}

function set(key, value) {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {}
  data[key] = value;
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
}

function del(key) {
  let data = {};
  try {
    data = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {}
  delete data[key];
  fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));
}

module.exports = { get, set, del };
