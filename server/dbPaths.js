const path = require("path");
const fs = require("fs");

function getDbPaths() {
  const userDataPath = process.env.USER_DATA_PATH;

  const dbPath =
    process.env.DB_PATH ||
    (userDataPath
      ? path.join(userDataPath, "app_data.db")
      : path.join(__dirname, "../electron/app_data.db"));

  const backupFolder = userDataPath
    ? path.join(userDataPath, "backup")
    : path.join(__dirname, "../electron/backup");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  return { dbPath, backupFolder };
}

module.exports = { getDbPaths };
