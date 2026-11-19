// Copied from vosmos-events-client (src/common/badgePrint.js), itself from the main admin — keep in sync.
// Shared print settings for badges: defaults, page style for react-to-print, and a short summary.

export const PRINT_SETTINGS_DEFAULTS = {
  paperSize: "badge",
  customWidthMm: null,
  customHeightMm: null,
  orientation: "portrait",
  horizontalAlign: "center",
  verticalAlign: "top",
  marginTopMm: 0,
  marginLeftMm: 0,
};

// portrait dimensions in mm
export const PAPER_SIZES_MM = {
  A4: [210, 297],
  A5: [148, 210],
  A6: [105, 148],
  Letter: [215.9, 279.4],
};

export const getPrintSettings = (badge) => ({
  ...PRINT_SETTINGS_DEFAULTS,
  ...(badge?.printSettings || {}),
});

const FLEX_ALIGN = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
  top: "flex-start",
  middle: "center",
  bottom: "flex-end",
};

const orient = ([w, h], orientation) =>
  orientation === "landscape"
    ? [Math.max(w, h), Math.min(w, h)]
    : [Math.min(w, h), Math.max(w, h)];

// page size as { css: @page size value, width, height } with units
const getPageSize = (badge, settings) => {
  const { paperSize, orientation, customWidthMm, customHeightMm } = settings;
  if (PAPER_SIZES_MM[paperSize]) {
    const [w, h] = orient(PAPER_SIZES_MM[paperSize], orientation);
    return {
      css: `${paperSize} ${orientation}`,
      width: `${w}mm`,
      height: `${h}mm`,
    };
  }
  if (paperSize === "custom" && customWidthMm > 0 && customHeightMm > 0) {
    const [w, h] = orient([customWidthMm, customHeightMm], orientation);
    return { css: `${w}mm ${h}mm`, width: `${w}mm`, height: `${h}mm` };
  }
  // "badge" (or incomplete custom): page is exactly the badge
  const w = Number(badge?.width) || 0;
  const h = Number(badge?.height) || 0;
  return { css: `${w}px ${h}px`, width: `${w}px`, height: `${h}px` };
};

// pageStyle string for react-to-print
export const getBadgePageStyle = (badge) => {
  const settings = getPrintSettings(badge);
  const page = getPageSize(badge, settings);
  const fontFamily = badge?.fontFamily || "Arial";
  return `
      @page { size: ${page.css}; margin: 0; }
      @media print {
        html, body {
          width: ${page.width};
          height: ${page.height};
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden;
        }
        body {
          display: flex;
          justify-content: ${FLEX_ALIGN[settings.horizontalAlign] || "center"};
          align-items: ${FLEX_ALIGN[settings.verticalAlign] || "flex-start"};
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-card {
          flex-shrink: 0;
          top: ${Number(settings.marginTopMm) || 0}mm;
          left: ${Number(settings.marginLeftMm) || 0}mm;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-family: "${fontFamily}", sans-serif !important;
        }
      }
    `;
};

// e.g. "A4 portrait · center/top · margin 0/0 mm"
export const getPrintSettingsSummary = (badge) => {
  const s = getPrintSettings(badge);
  let paper;
  if (PAPER_SIZES_MM[s.paperSize]) paper = `${s.paperSize} ${s.orientation}`;
  else if (
    s.paperSize === "custom" &&
    s.customWidthMm > 0 &&
    s.customHeightMm > 0
  )
    paper = `Custom ${s.customWidthMm}×${s.customHeightMm} mm ${s.orientation}`;
  else
    paper = `Badge size (${Number(badge?.width) || 0}×${Number(badge?.height) || 0} px)`;
  return `${paper} · ${s.horizontalAlign}/${s.verticalAlign} · margin ${
    Number(s.marginTopMm) || 0
  }/${Number(s.marginLeftMm) || 0} mm`;
};
