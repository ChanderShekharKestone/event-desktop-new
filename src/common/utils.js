import { getByPath } from "../store/action";
export const directSave = (dispatch, type, payload, keyName, keyTarget) => {
  dispatch({ type, payload, keyName, keyTarget });
};
export const fetchData = (
  dispatch,
  path,
  data,
  name,
  method,
  keyName,
  toast,
  extra,
) => {
  dispatch(getByPath(path, data, name, method, keyName, toast, extra));
};

export const toastBoth = {
  // top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
  success: {
    type: "success",
    title: "Success",
    description: "Successfully Data Added",
    position: "top-center",
  },
  error: {
    type: "error",
    title: "Error",
    description: "apiMsg",
    position: "top-center",
  },
};
export const getToast = (type, title, description, position) => {
  const toast = JSON.parse(JSON.stringify(toastBoth));
  if (!type) return toast;
  let finalToast = {
    [type]: toast[type],
  };
  if (title) {
    finalToast[type].title = title;
  }
  if (description) {
    finalToast[type].description = description;
  }
  if (position) {
    finalToast[type].position = position;
  }
  return finalToast;
};

export const calculateFontSize = (text, maxWidth, maxFontSize) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let fontSize = maxFontSize;
  ctx.font = `${fontSize}px sans-serif`;
  while (ctx.measureText(text).width > maxWidth && fontSize > 8) {
    fontSize -= 1;
    ctx.font = `${fontSize}px sans-serif`;
  }
  return fontSize;
};

// Badge element sizes: a number of px, or "50%" of `total` (the badge width)
export const toPx = (value, total) => {
  if (typeof value === "string" && value.trim().endsWith("%")) {
    return Math.round(((parseFloat(value) || 0) / 100) * total);
  }
  return Number(value) || 0;
};

// Public scanner screens (lead capture booth / room): CSS background for the admin's CDN
// image, dimmed so the cards stand out. URL.href percent-encodes quotes, so the value can't
// break out of url("…"). Returns null when there's no usable image.
export const screenBackground = (value) => {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url("${url.href}") center / cover no-repeat fixed, #1f2937`;
  } catch {
    return null;
  }
};

// Screen settings "position" → flex alignment of the cards on wide screens
export const SCREEN_ALIGN = { left: "flex-start", center: "center", right: "flex-end" };
