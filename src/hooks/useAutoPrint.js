import { useEffect, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import useBadgePrint, { getBadgeByType } from "./useBadgePrint";

const useAutoPrint = ({
  userScanData,
  directDispatch,
  keyName,
  onAfterPrint,
  types,
}) => {
  const cardRef = useRef(null);
  const [badge, setBadge] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  // Snapshot of the user being printed — userScanData is cleared before the popup closes
  const [printingUser, setPrintingUser] = useState(null);

  const { pageStyle } = useBadgePrint(badge);

  /* ---------- badge selection ---------- */
  useEffect(() => {
    if (!userScanData?.badgeData?.length) return;
    setBadge(
      getBadgeByType(userScanData.userInfo, userScanData.badgeData, types),
    );
  }, [userScanData, types]);

  const handlePrint = useReactToPrint({
    contentRef: cardRef,
    documentTitle: userScanData?.userInfo?.email || "badge",
    pageStyle,
    onAfterPrint: () => {
      setTimeout(() => {
        setIsPrinting(false);
      }, 7000);
      directDispatch(null, keyName);
      onAfterPrint?.();
    },
  });

  /* ---------- auto print ---------- */
  useEffect(() => {
    if (userScanData?.userInfo && badge) {
      setPrintingUser(userScanData.userInfo);
      setIsPrinting(true);
      handlePrint();
    }
  }, [userScanData, badge, handlePrint]);

  return { badge, cardRef, isPrinting, printingUser };
};

export default useAutoPrint;
