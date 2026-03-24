import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Paper,
  Snackbar,
  Typography,
} from "@mui/material";
import { useSelector } from "react-redux";
import BarcodeReader from "react-barcode-reader";

import {
  apiUserScan,
  apiUserSearch,
  apiAttendeeTypes,
  apiBadgeTemplates,
  method,
} from "../../apiPath";
import keyNames from "../../keyName";
import { useApi, useDirect, useAutoPrint, useQrScanner } from "../../hooks";
import { getToast } from "../../common/utils";
import BadgePreview from "../../common/BadgePreview";
import { useEffect, useState } from "react";

const toast = getToast("error");

const Scan = () => {
  const hitApi = useApi();
  const directDispatch = useDirect();
  const { userScanData, attendeeTypesData, badgeTemplatesData, isLoading } = useSelector(
    (s) => s.mainReducer,
  );

  // Merge badge templates into scan data — same pattern as live-admin
  const enrichedScanData = userScanData
    ? { ...userScanData, badgeData: badgeTemplatesData || [] }
    : null;

  const [noBadgeAlert, setNoBadgeAlert] = useState(false);

  const handleCheckin = (id) => {
    hitApi(
      apiUserScan,
      {
        id,
        isCheckedIn: true,
        checkedInTime: new Date().toISOString(),
        isPrintClicked: true,
      },
      method.post,
      keyNames.userScanData,
      toast,
      { type: "get" },
    );
  };

  const { startScanning, isScanning, resetScanner } = useQrScanner({
    onScan: (text) => {
      const { id } = JSON.parse(text);
      handleCheckin(id);
    },
  });

  const [showSearch, setShowSearch] = useState(false);
  const [email, setEmail] = useState(null);
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const { badge, cardRef, isPrinting } = useAutoPrint({
    userScanData: enrichedScanData,
    directDispatch,
    keyName: keyNames.userScanData,
    types: attendeeTypesData,
    onAfterPrint: () => {
      setShowSearch(false);
      setEmail(null);
    },
  });

  // Show alert when user checked in but no badge templates pulled yet
  useEffect(() => {
    if (userScanData?.userInfo && !badgeTemplatesData?.length) {
      setNoBadgeAlert(true);
      directDispatch(null, keyNames.userScanData);
      setShowSearch(false);
      setEmail(null);
    }
  }, [userScanData, badgeTemplatesData, directDispatch]);

  useEffect(() => {
    hitApi(apiAttendeeTypes, null, method.get, keyNames.attendeeTypesData, null);
    hitApi(apiBadgeTemplates, null, method.get, keyNames.badgeTemplatesData, null);
  }, [hitApi]);

  const handleSearch = () => {
    if (isValidEmail) {
      hitApi(
        apiUserSearch,
        {
          email,
          isCheckedIn: true,
          checkedInTime: new Date().toISOString(),
          isPrintClicked: true,
        },
        method.post,
        keyNames.userScanData,
        toast,
        { type: "get", changeLoading: false },
      );
    }
  };

  const handleSearchReset = () => {
    setShowSearch(!showSearch);
    setEmail(null);
  };

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
      {!isPrinting && (
        <BarcodeReader
          onScan={(data) => handleCheckin(JSON.parse(data).id)}
          onError={(err) => console.error(err)}
        />
      )}

      <BadgePreview badge={badge} userInfo={enrichedScanData?.userInfo} cardRef={cardRef} />

      <Snackbar
        open={noBadgeAlert}
        autoHideDuration={5000}
        onClose={() => setNoBadgeAlert(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setNoBadgeAlert(false)} sx={{ width: "100%" }}>
          No badge template found. Please pull badge templates from Settings.
        </Alert>
      </Snackbar>

      <Paper
        sx={{
          maxWidth: 420,
          minWidth: 320,
          p: 5,
          borderRadius: 3,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Dialog open={isPrinting}>
          <DialogContent sx={{ textAlign: "center", p: 7 }}>
            <CircularProgress />
            <Typography variant="h4" mt={2}>
              Printing in progress… <br />
              please wait
            </Typography>
          </DialogContent>
        </Dialog>

        <Typography textAlign="center" variant="h5" fontWeight={700} gutterBottom>
          {showSearch ? "Search Manually" : "Scan Your QR Code"}
        </Typography>
        <Typography textAlign="center" variant="h6" color="text.secondary" mb={3}>
          Position the QR code within the frame to check in automatically
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
            <Button variant="contained" size="large" fullWidth onClick={isScanning ? resetScanner : startScanning}>
              {isScanning ? "Stop Scanning" : "Scan QR Code"}
            </Button>
          </>
        ) : (
          <Box sx={{ width: "100%", mt: 3 }}>
            <FormControl fullWidth>
              <InputLabel htmlFor="email-search">Email</InputLabel>
              <OutlinedInput
                id="email-search"
                label="Email"
                value={email ?? ""}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                type="email"
                endAdornment={
                  <InputAdornment position="end">
                    <Button
                      variant="contained"
                      disabled={!isValidEmail || isLoading === "userScanData"}
                      onClick={handleSearch}
                    >
                      Search
                    </Button>
                  </InputAdornment>
                }
              />
            </FormControl>
          </Box>
        )}

        <Divider sx={{ my: 2 }}>OR</Divider>
        <Box textAlign="center">
          <Button
            variant="outlined"
            color="primary"
            onClick={handleSearchReset}
            disabled={isScanning || isLoading === "userScanData"}
          >
            {showSearch ? "Scan QR Code" : "Can't scan? Search manually"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default Scan;
