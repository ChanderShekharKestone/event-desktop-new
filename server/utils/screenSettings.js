/**
 * Look of a public scanner screen (kiosk, booth, session room): background image
 * (CDN URL), title, description and where the cards sit. Empty values mean "use the default".
 * Copied from the diy-ui api (utils/screenSettings.js), without the Mongoose schema.
 */

const LIMITS = { backgroundUrl: 2000, title: 120, description: 300 };
const POSITIONS = ["left", "center", "right"];
const EMPTY = { backgroundUrl: "", title: "", description: "", position: "center" };

const toScreenSettings = (doc) => ({
  backgroundUrl: doc?.backgroundUrl || "",
  title: doc?.title || "",
  description: doc?.description || "",
  position: POSITIONS.includes(doc?.position) ? doc.position : "center",
});

// Only absolute http(s) URLs — the screen puts this straight into a CSS background
const isImageUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/** Validates a request body → { error } or { settings } (missing fields reset to defaults) */
const readScreenSettings = (body) => {
  const settings = { ...EMPTY };
  for (const [key, max] of Object.entries(LIMITS)) {
    const value = body?.[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") return { error: `${key} must be text` };
    const trimmed = value.trim();
    if (trimmed.length > max) return { error: `${key} must be ${max} characters or fewer` };
    settings[key] = trimmed;
  }
  if (body?.position !== undefined) {
    if (!POSITIONS.includes(body.position)) return { error: "Position must be left, center or right" };
    settings.position = body.position;
  }
  if (settings.backgroundUrl && !isImageUrl(settings.backgroundUrl)) {
    return { error: "Background image must be an http(s) URL" };
  }
  return { settings };
};

module.exports = { toScreenSettings, readScreenSettings };
