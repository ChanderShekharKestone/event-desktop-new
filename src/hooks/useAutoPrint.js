import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import useBadgePrint, { getBadgeByType } from './useBadgePrint';

// types: attendee types pulled from the cloud — fallback for matching a badge template
const useAutoPrint = ({ userScanData, directDispatch, keyName, onAfterPrint, types }) => {
  const cardRef = useRef(null);
  // Snapshot of the badge + user being printed — userScanData is cleared before the popup closes
  const [badge, setBadge] = useState(null);
  const [printingUser, setPrintingUser] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printPending, setPrintPending] = useState(false);

  const { pageStyle } = useBadgePrint(badge);

  // userInfo / badgeData keep their references across renders (userScanData itself doesn't),
  // so each scan response triggers exactly one print
  const userInfo = userScanData?.userInfo;
  const badgeData = userScanData?.badgeData;
  const typeList = types?.data || types;
  const selectedBadge = useMemo(
    () => (userInfo && badgeData?.length ? getBadgeByType(userInfo, badgeData, typeList) : null),
    [userInfo, badgeData, typeList]
  );

  const handlePrint = useReactToPrint({
    contentRef: cardRef,
    // Shown in the tab title / print header while printing — keep attendee PII (email) out of it
    documentTitle: 'badge',
    pageStyle,
    onAfterPrint: () => {
      setTimeout(() => {
        setIsPrinting(false);
      }, 3000);
      directDispatch(null, keyName);
      onAfterPrint?.();
    },
  });

  /* ---------- new scan: snapshot badge + user, open the popup ---------- */
  useEffect(() => {
    if (!userInfo || !selectedBadge) return;
    setBadge(selectedBadge);
    setPrintingUser(userInfo);
    setIsPrinting(true);
    setPrintPending(true);
  }, [userInfo, selectedBadge]);

  /* ---------- print on the next render, once the card + pageStyle show the new badge ---------- */
  useEffect(() => {
    if (!printPending) return;
    setPrintPending(false);
    handlePrint();
  }, [printPending, handlePrint]);

  return { badge, cardRef, isPrinting, printingUser };
};

export default useAutoPrint;
