const router = require("express").Router();
const os = require("os");
const { PORT } = require("../config");

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

// GET /api/app-settings/lan-url
router.get("/lan-url", (_req, res) => {
  const ip = getLanIp();
  res.json({ status: 200, data: `http://${ip}:${PORT}` });
});

module.exports = router;
