const CLOUD_BASE = "https://api.vosmos.events/offline/api";

// Lead capture syncs with the diy-ui api (vosmos-events-client's backend), which owns the
// lead capture data: open offline endpoints at /api/v1/offline/lead-capture
const LEAD_CLOUD_BASE = "https://frontapi.vosmos.events/dashboard/api/v1/offline/lead-capture";

const PORT = 4001;
const HTTPS_PORT = 4002;

const CLOUD_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0",
  origin: "https://self.nowvirtual.live",
};

// No origin header for the diy-ui api: its CORS refuses unknown origins, and server-to-server
// calls (no origin) are allowed
const LEAD_CLOUD_HEADERS = { "User-Agent": "VosmosEventDesktop" };

module.exports = { CLOUD_BASE, LEAD_CLOUD_BASE, PORT, HTTPS_PORT, CLOUD_HEADERS, LEAD_CLOUD_HEADERS };
