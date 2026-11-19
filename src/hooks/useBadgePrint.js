import { useEffect, useMemo } from "react";
import { getBadgePageStyle } from "../common/badgePrint";

// Strips everything but letters/digits before lowercasing, so "Partner Delegate",
// "partner-delegate" and "partnerdelegate" are all treated as the same type.
const normalizeType = (value) =>
  value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? null;

/**
 * Badge template for a delegate. Same matching as vosmos-events-client:
 * delegate type (e.g. "speaker") vs badge.type (e.g. "Speaker"), exact first, then a
 * prefix match for templates with a mode suffix ("Partner Delegate - Onsite").
 * Desktop fallback: the attendee type's displayName (types pulled from the cloud),
 * as before. Then the first badge.
 */
export const getBadgeByType = (user, badgeData, types) => {
  if (!badgeData?.length) return null;
  const userKey = user?.type || user?.roleId;
  const resolvedType = normalizeType(userKey);
  if (!resolvedType) return badgeData[0];

  const byType =
    badgeData.find((b) => normalizeType(b.type) === resolvedType) ||
    badgeData.find((b) => normalizeType(b.type)?.startsWith(resolvedType));
  if (byType) return byType;

  const displayName = normalizeType(
    types?.find((t) => t.name?.toLowerCase() === userKey?.toLowerCase())
      ?.displayName,
  );
  return (
    (displayName &&
      badgeData.find((b) => normalizeType(b.type) === displayName)) ||
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

  // Print page style — paper size, alignment and margins come from badge.printSettings (set in admin)
  const pageStyle = useMemo(() => getBadgePageStyle(badge), [badge]);

  return { pageStyle };
};

export default useBadgePrint;
