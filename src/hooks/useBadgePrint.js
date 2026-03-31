import { useEffect, useMemo } from "react";

export const getBadgeByType = (user, badgeData, types) => {
  if (!badgeData?.length) return null;
  let resolvedType = null;
  if (types?.length) {
    const userKey = (user?.type || user?.roleId)?.toLowerCase();
    const matched = types.find((t) => t.name?.toLowerCase() === userKey);
    resolvedType = matched?.displayName?.toLowerCase() ?? null;
  }
  return (
    badgeData.find((b) => b.type?.toLowerCase() === resolvedType) ||
    badgeData[0]
  );
};

const useBadgePrint = (badge) => {
  // Dynamic Google Font injection
  useEffect(() => {
    if (!badge?.fontFamily) return;
    const fontName = badge.fontFamily;
    const fontId = `print-font-${fontName.replace(/\s+/g, "-")}`;
    if (document.getElementById(fontId)) return;
    const link = document.createElement("link");
    link.id = fontId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(
      /\s+/g,
      "+",
    )}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
    return () => {
      const existing = document.getElementById(fontId);
      if (existing) existing.remove();
    };
  }, [badge?.fontFamily]);

  // Print page style
  const pageStyle = useMemo(() => {
    const marginMap = {
      left:   "margin-left: 0; margin-right: auto;",
      center: "margin-left: auto; margin-right: auto;",
      right:  "margin-left: auto; margin-right: 0;",
    };
    const marginStyle = marginMap[badge?.alignment] ?? marginMap.center;
    return `
      @page { size: auto; margin: 0; }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-card {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          font-family: "${badge?.fontFamily || "Arial"}", sans-serif !important;
          display: block;
          ${marginStyle}
        }
      }
    `;
  }, [badge?.fontFamily, badge?.alignment]);

  return { pageStyle };
};

export default useBadgePrint;
