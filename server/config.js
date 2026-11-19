const CLOUD_BASE = "https://api.vosmos.events/offline/api";

// Lead capture sync: same offline API (VosmosVirtualEvents routes/Offline.js)
const LEAD_CLOUD_BASE = `${CLOUD_BASE}/lead-capture`;

const PORT = 4001;
const HTTPS_PORT = 4002;

const CLOUD_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0",
  origin: "https://self.nowvirtual.live",
};

const LEAD_CLOUD_HEADERS = CLOUD_HEADERS;

module.exports = { CLOUD_BASE, LEAD_CLOUD_BASE, PORT, HTTPS_PORT, CLOUD_HEADERS, LEAD_CLOUD_HEADERS };
