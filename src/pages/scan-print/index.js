import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Paper,
  Snackbar,
  Typography,
} from "@mui/material";
import { useSelector } from "react-redux";
import BarcodeReader from "react-barcode-reader";

import {
  apiUserScan,
  apiAttendeeTypes,
  apiBadgeTemplates,
  method,
} from "../../apiPath";
import keyNames from "../../keyName";
import {
  useApi,
  useDirect,
  useAutoPrint,
  useQrScanner,
  useScanInput,
} from "../../hooks";
import BadgePreview from "../../common/BadgePreview";
import { useEffect, useRef, useState } from "react";
import SearchDelegates from "./SearchDelegates";

// Must match server/database/registrations.js — a QR scan of a badge already checked
// in gets this 409. Shown as the "Print again?" dialog instead of an error toast.
// (The search list asks its own "Print again?" before calling, so never hits it.)
const ALREADY_SCANNED_MESSAGE =
  "This QR code has already been scanned, please visit the help desk";

const Scan = () => {
  const hitApi = useApi();
  const directDispatch = useDirect();
  const {
    userScanData,
    attendeeTypesData,
    badgeTemplatesData,
    isLoading,
    apiErrors,
  } = useSelector((s) => s.mainReducer);

  // Merge badge templates into scan data — same pattern as live-admin
  const enrichedScanData = userScanData
    ? { ...userScanData, badgeData: badgeTemplatesData || [] }
    : null;

  const [noBadgeAlert, setNoBadgeAlert] = useState(false);

  // A check-in request is still in flight (isLoading stays 'userScanData' ~500ms after the
  // response too). Block new scans until it clears, so a slow answer for an earlier (e.g.
  // wrong) QR can't land on top of a later scan's result.
  const checkinPending = isLoading === keyNames.userScanData;

  // allowReprint: set by the search list's Print button and by confirming "Print again?".
  // A fresh QR scan never sets it, so an already-checked-in badge asks first.
  // Errors are shown from apiErrors below (not hitApi's toast), so the "already scanned"
  // one becomes the dialog instead of an error toast.
  const lastAttemptRef = useRef(null); // value of the last check-in call, or null
  const handleCheckin = (id, allowReprint = false) => {
    if (id === undefined || id === null || id === "") return;
    // A re-print is a deliberate click after the earlier call already answered (the
    // search Print button is disabled while one runs), so only scans wait for pending
    if (checkinPending && !allowReprint) return;
    lastAttemptRef.current = id;
    hitApi(
      apiUserScan,
      {
        // Raw QR text: the server reads uniqueUserId, cloud _id and older '{"id":…}' badges
        id,
        isCheckedIn: true,
        checkedInTime: new Date().toISOString(),
        isPrintClicked: true,
        allowReprint,
      },
      method.post,
      keyNames.userScanData,
      null,
      { type: "get" },
    );
  };

  const [reprintPrompt, setReprintPrompt] = useState(null); // raw scan value, or null
  useEffect(() => {
    const msg = apiErrors?.message;
    if (!msg || lastAttemptRef.current === null) return;
    if (msg === ALREADY_SCANNED_MESSAGE) {
      setReprintPrompt(lastAttemptRef.current);
    } else {
      directDispatch(
        { type: "error", title: "Error", description: msg, position: "top-center" },
        keyNames.toastData,
      );
    }
    directDispatch(null, keyNames.apiErrors);
  }, [apiErrors, directDispatch]);

  const confirmReprint = () => {
    if (reprintPrompt !== null) handleCheckin(reprintPrompt, true);
    setReprintPrompt(null);
  };

  // eslint-disable-next-line no-unused-vars -- startScanning/resetScanner kept for the commented-out button below
  const { startScanning, isScanning, resetScanner } = useQrScanner({
    onScan: (text) => handleCheckin(text),
  });

  const [showSearch, setShowSearch] = useState(false);

  const { badge, cardRef, isPrinting, printingUser } = useAutoPrint({
    userScanData: enrichedScanData,
    directDispatch,
    keyName: keyNames.userScanData,
    types: attendeeTypesData,
    onAfterPrint: () => setShowSearch(false),
  });

  // Same condition as the BarcodeReader below — no scanning while a badge prints, a
  // previous check-in is in flight, or the "Print again?" dialog is open
  const scanEnabled = !isPrinting && !checkinPending && reprintPrompt === null;
  useScanInput((text) => handleCheckin(text), scanEnabled);

  // Show alert when user checked in but no badge templates pulled yet
  useEffect(() => {
    if (userScanData?.userInfo && !badgeTemplatesData?.length) {
      setNoBadgeAlert(true);
      directDispatch(null, keyNames.userScanData);
      setShowSearch(false);
    }
  }, [userScanData, badgeTemplatesData, directDispatch]);

  useEffect(() => {
    hitApi(
      apiAttendeeTypes,
      null,
      method.get,
      keyNames.attendeeTypesData,
      null,
    );
    hitApi(
      apiBadgeTemplates,
      null,
      method.get,
      keyNames.badgeTemplatesData,
      null,
    );
  }, [hitApi]);

  const types = attendeeTypesData?.data || attendeeTypesData || [];
  const printingKey = (
    printingUser?.type || printingUser?.roleId
  )?.toLowerCase();
  const printingType = printingKey
    ? types.find((t) => t.name?.toLowerCase() === printingKey)
    : null;

  const handleSearchReset = () => setShowSearch(!showSearch);

  return (
    <Box
      sx={{
        minHeight: "80vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: 2,
      }}
    >
      {scanEnabled && (
        <BarcodeReader
          onScan={(data) => handleCheckin(data)}
          onError={(err) => console.error(err)}
        />
      )}

      <BadgePreview
        badge={badge}
        userInfo={enrichedScanData?.userInfo}
        cardRef={cardRef}
      />

      <Snackbar
        open={noBadgeAlert}
        autoHideDuration={5000}
        onClose={() => setNoBadgeAlert(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity="warning"
          onClose={() => setNoBadgeAlert(false)}
          sx={{ width: "100%" }}
        >
          No badge template found. Please pull badge templates from Settings.
        </Alert>
      </Snackbar>

      <Paper
        sx={{
          // Wider in search mode to fit the result list
          maxWidth: showSearch ? 520 : 420,
          width: "100%",
          minWidth: 320,
          p: 5,
          borderRadius: 3,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Dialog
          open={isPrinting}
          PaperProps={{
            sx: { borderRadius: 3, overflow: "hidden", minWidth: 480 },
          }}
        >
          <DialogContent sx={{ textAlign: "center", p: 7 }}>
            <CircularProgress />
            <Typography variant="h4" mt={2}>
              Printing in progress… <br />
              please wait
            </Typography>
          </DialogContent>
          {printingType && (
            <Box
              display="flex"
              sx={{
                borderTop: "1px solid rgba(32,23,81,0.12)",
                bgcolor: "rgba(32,23,81,0.04)",
              }}
            >
              <Box flex={1} px={3} py={2} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Attendee Type
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight={700}
                  sx={{ color: "#201751" }}
                >
                  {printingType.displayName}
                </Typography>
              </Box>
              <Divider orientation="vertical" flexItem />
              <Box flex={1} px={3} py={2} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Lanyard
                </Typography>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={1}
                >
                  {printingType.color && (
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        flexShrink: 0,
                        bgcolor: printingType.color,
                        border: "1px solid rgba(0,0,0,0.2)",
                      }}
                    />
                  )}
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{ color: "#201751" }}
                  >
                    {printingType.colorName || printingType.color || "—"}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}
        </Dialog>

        <Dialog open={reprintPrompt !== null} onClose={() => setReprintPrompt(null)}>
          <DialogTitle>Print again?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              This badge has already been printed. Would you like to print it
              again?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReprintPrompt(null)}>Cancel</Button>
            <Button variant="contained" onClick={confirmReprint} autoFocus>
              Print again
            </Button>
          </DialogActions>
        </Dialog>

        <Typography
          textAlign="center"
          variant="h5"
          fontWeight={700}
          gutterBottom
        >
          {showSearch ? "Search Manually" : "Scan Your QR Code"}
        </Typography>
        <Typography
          textAlign="center"
          variant="h6"
          color="text.secondary"
          mb={3}
        >
          {!showSearch
            ? "Position the QR code within the frame to check in automatically"
            : "Search by name, email, organization, designation or type"}
        </Typography>

        {!showSearch ? (
          <>
            <Box
              id="qr-reader"
              className="scanner-line"
              sx={{
                minHeight: 200,
                border: "2px dashed #ccc",
                borderRadius: 2,
                mb: 3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                position: "relative",
              }}
            />
            {/* Scan QR Code (camera) button commented, same as vosmos-events-client
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={checkinPending}
              onClick={isScanning ? resetScanner : startScanning}
            >
              {isScanning ? "Stop Scanning" : "Scan QR Code"}
            </Button>
            */}
          </>
        ) : (
          <SearchDelegates onPrint={handleCheckin} />
        )}

        <Divider sx={{ my: 2 }}>OR</Divider>
        <Box textAlign="center">
          <Button
            variant="outlined"
            color="primary"
            onClick={handleSearchReset}
            disabled={isScanning || checkinPending}
          >
            {showSearch ? "Scan QR Code" : "Can't scan? Search manually"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default Scan;
