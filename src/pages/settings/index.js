import { useEffect, useRef, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Divider,
  CircularProgress,
  Chip,
  Tooltip,
  IconButton,
  InputAdornment,
  OutlinedInput,
} from "@mui/material";
import { CloudSync, CloudUpload, Category, Badge, AppRegistration, ContentCopy, Check, QrCode2, Refresh, DeleteOutline, DeleteSweep } from "@mui/icons-material";
import { useSelector } from "react-redux";
import axios from "axios";
import useApi from "../../hooks/useApi";
import { useDirect } from "../../hooks";
import keyNames from "../../keyName";
import { getToast } from "../../common/utils";
import {
  apiSyncPull,
  apiSyncPush,
  apiSyncPendingCount,
  apiAttendeeTypesPull,
  apiAttendeeTypes,
  apiBadgeTemplates,
  apiBadgeTemplatesPull,
  apiRegistrationFields,
  apiRegistrationFieldsPull,
  apiLocalIp,
  apiSdkConfigs,
  method,
  apiPath,
} from "../../apiPath";

const toast = getToast("error");

const SyncButton = ({ label, icon: Icon, onClick, loading, disabled }) => (
  <Button
    variant="outlined"
    startIcon={loading ? <CircularProgress size={16} /> : <Icon />}
    onClick={onClick}
    disabled={loading || disabled}
    sx={{
      borderColor: "rgba(32,23,81,0.3)",
      color: "#201751",
      borderRadius: "10px",
      px: 3,
      py: 1.25,
      fontWeight: 600,
      textTransform: "none",
      "&:hover": {
        borderColor: "#201751",
        bgcolor: "rgba(32,23,81,0.06)",
      },
    }}
  >
    {label}
  </Button>
);

const Settings = () => {
  const hitApi = useApi();
  const directDispatch = useDirect();
  const notify = (type, description) =>
    directDispatch(
      { type, title: type === "success" ? "Success" : "Error", description, position: "top-center" },
      keyNames.toastData,
    );
  const {
    isLoading,
    attendeeTypesData,
    badgeTemplatesData,
    syncPendingCount,
    registrationFormsData,
  } = useSelector((s) => s.mainReducer);
  const attendeeTypes = attendeeTypesData?.data || attendeeTypesData || [];
  const badgeTemplates = badgeTemplatesData?.data || badgeTemplatesData || [];
  const pendingCount = syncPendingCount?.count ?? 0;
  const [kioskUrl, setKioskUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchKioskUrl = () => {
    fetch(apiPath + apiLocalIp)
      .then((r) => r.json())
      .then(({ ip, port, protocol = "https" }) => setKioskUrl(`${protocol}://${ip}:${port}/#/scan`))
      .catch(() => setKioskUrl("Could not detect LAN IP. Check network and press refresh."));
  };

  useEffect(() => {
    fetchKioskUrl();
  }, []);

  const [sdkConfigs, setSdkConfigs] = useState([]);
  const [deletingSdk, setDeletingSdk] = useState(null); // config id, "all", or null

  const fetchSdkConfigs = () => {
    axios
      .get(apiPath + apiSdkConfigs)
      .then(({ data }) => setSdkConfigs(data.data || []))
      .catch(() => setSdkConfigs([]));
  };

  useEffect(() => {
    fetchSdkConfigs();
  }, []);

  const deleteSdk = async (config) => {
    const isAll = !config;
    const msg = isAll
      ? "Delete ALL downloaded SDK files? Registration forms will use the default widget."
      : `Delete SDK file for "${config.type}"? This form will use the default widget.`;
    if (!window.confirm(msg)) return;
    setDeletingSdk(isAll ? "all" : config._id);
    try {
      const { data } = await axios.delete(
        apiPath + apiSdkConfigs + (isAll ? "" : `/${config._id}`),
      );
      notify("success", data.message || "SDK file deleted");
      fetchSdkConfigs();
    } catch (err) {
      notify("error", err.response?.data?.message || "Failed to delete SDK file");
    } finally {
      setDeletingSdk(null);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(kioskUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    hitApi(
      apiSyncPendingCount,
      null,
      method.get,
      keyNames.syncPendingCount,
      null,
    );
    hitApi(
      apiRegistrationFields,
      null,
      method.get,
      keyNames.registrationFormsData,
      null,
    );
  }, [hitApi]);

  const handlePull = () => {
    hitApi(apiSyncPull, null, method.post, keyNames.syncPullData, toast);
  };

  const wasPushing = useRef(false);

  const handlePush = () => {
    hitApi(apiSyncPush, null, method.post, keyNames.syncPushData, toast);
  };

  useEffect(() => {
    if (isLoading === keyNames.syncPushData) {
      wasPushing.current = true;
    } else if (wasPushing.current && isLoading === "noLoading") {
      wasPushing.current = false;
      hitApi(apiSyncPendingCount, null, method.get, keyNames.syncPendingCount, null);
    }
  }, [isLoading, hitApi]);

  return (
    <Box>
      <Typography
        variant="h5"
        fontWeight={700}
        sx={{ color: "#201751", mb: 3 }}
      >
        Settings
      </Typography>

      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid rgba(32,23,81,0.12)",
          p: 3,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ color: "#201751", mb: 0.5 }}
        >
          Sync
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 2.5 }}>
          Pull latest registrations from cloud or push local changes. Auto-sync
          runs every 5 min (pull) and 2 min (push).
        </Typography>
        <Divider sx={{ mb: 2.5, borderColor: "rgba(32,23,81,0.08)" }} />
        <Box display="flex" gap={2}>
          <Tooltip
            title={
              pendingCount > 0
                ? `${pendingCount} local change${pendingCount > 1 ? "s" : ""} not yet pushed — push first`
                : ""
            }
            disableHoverListener={pendingCount === 0}
          >
            <span>
              <SyncButton
                label="Pull from Cloud"
                icon={CloudSync}
                onClick={handlePull}
                loading={isLoading === keyNames.syncPullData}
                disabled={pendingCount > 0}
              />
            </span>
          </Tooltip>
          <SyncButton
            label="Push to Cloud"
            icon={CloudUpload}
            onClick={handlePush}
            loading={isLoading === keyNames.syncPushData}
          />
        </Box>
      </Box>

      {/* Attendee Types */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid rgba(32,23,81,0.12)",
          p: 3,
          mt: 3,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ color: "#201751", mb: 0.5 }}
        >
          Attendee Types
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 2.5 }}>
          Pull the latest attendee role types from cloud. Reflects any changes
          made on cloud immediately.
        </Typography>
        <Divider sx={{ mb: 2.5, borderColor: "rgba(32,23,81,0.08)" }} />
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <SyncButton
            label="Pull Attendee Types"
            icon={Category}
            onClick={() =>
              hitApi(
                apiAttendeeTypesPull,
                null,
                method.post,
                keyNames.attendeeTypesData,
                toast,
              )
            }
            loading={isLoading === keyNames.attendeeTypesData}
          />
          {attendeeTypes?.map((t) => (
            <Chip
              key={t._id}
              label={t.displayName}
              size="small"
              sx={{
                bgcolor: "rgba(32,23,81,0.08)",
                color: "#201751",
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Badge Templates */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid rgba(32,23,81,0.12)",
          p: 3,
          mt: 3,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ color: "#201751", mb: 0.5 }}
        >
          Badge Templates
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 2.5 }}>
          Pull badge templates from cloud. These are used to print badges after
          check-in.
        </Typography>
        <Divider sx={{ mb: 2.5, borderColor: "rgba(32,23,81,0.08)" }} />
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <SyncButton
            label="Pull Badge Templates"
            icon={Badge}
            onClick={() =>
              hitApi(
                apiBadgeTemplatesPull,
                null,
                method.post,
                keyNames.badgeTemplatesData,
                toast,
              )
            }
            loading={isLoading === keyNames.badgeTemplatesData}
          />
          {badgeTemplates?.length > 0 ? (
            badgeTemplates.map((t) => (
              <Chip
                key={t._id}
                label={t.name}
                size="small"
                sx={{
                  bgcolor: "rgba(32,23,81,0.08)",
                  color: "#201751",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                }}
              />
            ))
          ) : (
            <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
              No templates pulled yet
            </Typography>
          )}
        </Box>
      </Box>

      {/* Scan Kiosk Link */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid rgba(32,23,81,0.12)",
          p: 3,
          mt: 3,
        }}
      >
        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
          <QrCode2 sx={{ color: "#201751", fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#201751" }}>
            Scan Kiosk
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 2.5 }}>
          Share this link with kiosk devices on the same network to open the scan page.
        </Typography>
        <Divider sx={{ mb: 2.5, borderColor: "rgba(32,23,81,0.08)" }} />
        <OutlinedInput
          readOnly
          fullWidth
          value={kioskUrl}
          size="small"
          sx={{
            borderRadius: "10px",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: "rgba(32,23,81,0.25)",
            },
          }}
          endAdornment={
            <InputAdornment position="end">
              <IconButton onClick={fetchKioskUrl} edge="end" sx={{ color: "#201751" }}>
                <Refresh fontSize="small" />
              </IconButton>
              <IconButton onClick={handleCopy} edge="end" sx={{ color: copied ? "#16A34A" : "#201751" }}>
                {copied ? <Check fontSize="small" /> : <ContentCopy fontSize="small" />}
              </IconButton>
            </InputAdornment>
          }
        />
      </Box>

      {/* Registration Forms */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid rgba(32,23,81,0.12)",
          p: 3,
          mt: 3,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#201751", mb: 0.5 }}>
          Registration Forms
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 2.5 }}>
          Pull registration form configurations from cloud. Each attendee type can have its own form.
        </Typography>
        <Divider sx={{ mb: 2.5, borderColor: "rgba(32,23,81,0.08)" }} />
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <SyncButton
            label="Pull Registration Forms"
            icon={AppRegistration}
            onClick={() =>
              hitApi(apiRegistrationFieldsPull, null, method.post, keyNames.registrationFormsData, toast)
            }
            loading={isLoading === keyNames.registrationFormsData}
          />
          {(registrationFormsData?.data || registrationFormsData || []).length > 0 ? (
            (registrationFormsData?.data || registrationFormsData).map((f) => (
              <Chip
                key={f._id}
                label={f.attendeeTypeName}
                size="small"
                sx={{
                  bgcolor: f.isRegistrationPageRequired
                    ? "rgba(32,23,81,0.08)"
                    : "rgba(156,163,175,0.15)",
                  color: f.isRegistrationPageRequired ? "#201751" : "#6B7280",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                }}
              />
            ))
          ) : (
            <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
              No registration forms pulled yet
            </Typography>
          )}
        </Box>
      </Box>

      {/* SDK Files */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid rgba(32,23,81,0.12)",
          p: 3,
          mt: 3,
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#201751", mb: 0.5 }}>
          SDK Files
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 2.5 }}>
          Downloaded registration SDK files. Deleting one makes that form fall back to the default widget.
          "Delete All" also removes leftover files from previous events.
        </Typography>
        <Divider sx={{ mb: 2.5, borderColor: "rgba(32,23,81,0.08)" }} />
        <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap">
          {sdkConfigs.length > 0 ? (
            sdkConfigs.map((c) => (
              <Chip
                key={c._id}
                label={`${c.type}${c.sdkLocalPath ? "" : " (file missing)"}`}
                size="small"
                title={c.sdkCloudPath}
                onDelete={deletingSdk ? undefined : () => deleteSdk(c)}
                deleteIcon={
                  deletingSdk === c._id ? <CircularProgress size={14} /> : <DeleteOutline />
                }
                sx={{
                  bgcolor: "rgba(32,23,81,0.08)",
                  color: "#201751",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                }}
              />
            ))
          ) : (
            <Typography variant="caption" sx={{ color: "#9CA3AF" }}>
              No SDK configs saved
            </Typography>
          )}
        </Box>
        <Box mt={2.5}>
          <Button
            variant="outlined"
            color="error"
            startIcon={deletingSdk === "all" ? <CircularProgress size={16} /> : <DeleteSweep />}
            onClick={() => deleteSdk(null)}
            disabled={!!deletingSdk}
            sx={{ borderRadius: "10px", px: 3, py: 1.25, fontWeight: 600, textTransform: "none" }}
          >
            Delete All SDK Files
          </Button>
        </Box>
      </Box>

    </Box>
  );
};

export default Settings;
