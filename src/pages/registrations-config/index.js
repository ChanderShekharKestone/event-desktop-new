import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
} from "@mui/material";
import { ContentCopy, Check, CloudDownload, FolderOpen, AppRegistration } from "@mui/icons-material";
import axios from "axios";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { apiPath, apiSdkConfigs, apiRegistrationFields } from "../../apiPath";
import keyNames from "../../keyName";
import useApi from "../../hooks/useApi";
import { method } from "../../apiPath";

const REGISTER_BASE = window.location.origin;

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "10px",
    fontSize: "0.875rem",
    "& fieldset": { borderColor: "rgba(47,26,122,0.2)" },
    "&:hover fieldset": { borderColor: "rgba(47,26,122,0.4)" },
    "&.Mui-focused fieldset": { borderColor: "#2F1A7A" },
  },
};

const getPublicPath = (sdkLocalPath) => {
  if (!sdkLocalPath) return null;
  const basename = sdkLocalPath.split(/[\\/]/).pop();
  return `/sdk-files/${basename}`;
};

const DEFAULT_SDK = "/widget.js";

const FormRow = ({ form, sdkConfig, lanBase, onSaved }) => {
  const [sdkUrl, setSdkUrl] = useState(sdkConfig?.sdkCloudPath || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedLan, setCopiedLan] = useState(false);

  // Sync when sdkConfig loads asynchronously
  useEffect(() => {
    setSdkUrl(sdkConfig?.sdkCloudPath || "");
  }, [sdkConfig]);

  const regUrl = `${REGISTER_BASE}/#/register?type=${encodeURIComponent(form.attendeeTypeName)}`;
  const lanUrl = lanBase ? `${lanBase}/#/register?type=${encodeURIComponent(form.attendeeTypeName)}` : null;

  const copyUrl = () => {
    navigator.clipboard.writeText(regUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const copyLanUrl = () => {
    if (!lanUrl) return;
    navigator.clipboard.writeText(lanUrl).then(() => {
      setCopiedLan(true);
      setTimeout(() => setCopiedLan(false), 1500);
    });
  };

  const handleSave = async () => {
    if (!sdkUrl.trim()) { setError("SDK URL is required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload = { name: form.attendeeTypeName, sdkCloudPath: sdkUrl.trim(), type: form.attendeeTypeName };
      if (sdkConfig) {
        await axios.put(`${apiPath}${apiSdkConfigs}/${sdkConfig._id}`, payload);
      } else {
        await axios.post(`${apiPath}${apiSdkConfigs}`, payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: "#fff",
        border: "1px solid rgba(47,26,122,0.12)",
        borderRadius: "12px",
        p: 2.5,
        mb: 2,
      }}
    >
      <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap" mb={2}>
        <Chip
          label={form.attendeeTypeName}
          size="small"
          sx={{ bgcolor: "rgba(47,26,122,0.1)", color: "#2F1A7A", fontWeight: 700, fontSize: "0.8rem" }}
        />
        {form.isRegistrationPageRequired ? (
          <Chip label="Registration Required" size="small"
            sx={{ bgcolor: "rgba(22,163,74,0.1)", color: "#16A34A", fontWeight: 600, fontSize: "0.72rem" }} />
        ) : (
          <Chip label="Optional" size="small"
            sx={{ bgcolor: "rgba(156,163,175,0.15)", color: "#6B7280", fontWeight: 600, fontSize: "0.72rem" }} />
        )}
        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5} ml="auto">
          <Box display="flex" alignItems="center" gap={0.5}>
            <Typography variant="caption" sx={{ color: "#2F1A7A", fontFamily: "monospace", fontSize: "0.72rem" }}>
              {regUrl}
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy local URL"}>
              <IconButton size="small" onClick={copyUrl} sx={{ color: "#2F1A7A" }}>
                {copied ? <Check sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
          </Box>
          {lanUrl && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <Typography variant="caption" sx={{ color: "#059669", fontFamily: "monospace", fontSize: "0.72rem" }}>
                {lanUrl}
              </Typography>
              <Tooltip title={copiedLan ? "Copied!" : "Copy LAN URL"}>
                <IconButton size="small" onClick={copyLanUrl} sx={{ color: "#059669" }}>
                  {copiedLan ? <Check sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Box>

      <Box display="flex" gap={1.5} alignItems="flex-start">
        <TextField
          label="SDK Cloud URL"
          value={sdkUrl}
          onChange={(e) => { setSdkUrl(e.target.value); setError(""); }}
          size="small"
          fullWidth
          placeholder="https://cdn.example.com/sdk/registration.js"
          sx={fieldSx}
          error={!!error}
          helperText={error || ""}
        />
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <CloudDownload />}
          sx={{
            borderRadius: "10px",
            background: "linear-gradient(135deg, #2F1A7A, #6B4FC8)",
            fontWeight: 600,
            textTransform: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
            mt: 0.25,
            "&:hover": { background: "linear-gradient(135deg, #231460, #9775FA)" },
          }}
        >
          {saving ? "Saving…" : sdkConfig ? "Update SDK" : "Save & Download"}
        </Button>
      </Box>

      <Box display="flex" alignItems="center" gap={1} mt={1.5}>
        <FolderOpen sx={{ fontSize: 15, color: "#9CA3AF" }} />
        <Typography variant="caption" sx={{ color: "#6B7280", fontFamily: "monospace", fontSize: "0.72rem" }}>
          {sdkConfig?.sdkLocalPath
            ? getPublicPath(sdkConfig.sdkLocalPath)
            : DEFAULT_SDK}
        </Typography>
        {!sdkConfig?.sdkLocalPath && (
          <Typography variant="caption" sx={{ color: "#9CA3AF", fontSize: "0.68rem" }}>
            (default)
          </Typography>
        )}
      </Box>
    </Box>
  );
};

const RegistrationsConfig = () => {
  const hitApi = useApi();
  const navigate = useNavigate();
  const { registrationFormsData } = useSelector((s) => s.mainReducer);
  const forms = registrationFormsData?.data || registrationFormsData || [];

  const [sdkConfigs, setSdkConfigs] = useState([]);
  const [lanBase, setLanBase] = useState(null);

  // Load forms from local SQLite on mount (in case Redux was reset by refresh)
  useEffect(() => {
    hitApi(apiRegistrationFields, null, method.get, keyNames.registrationFormsData, null);
  }, [hitApi]);

  const fetchSdkConfigs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiPath}${apiSdkConfigs}`);
      setSdkConfigs(data.data || []);
    } catch (err) {
      console.error("Failed to fetch SDK configs:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchSdkConfigs();
    axios.get(`${apiPath}app-settings/lan-url`)
      .then(({ data }) => setLanBase(data.data))
      .catch(() => {});
  }, [fetchSdkConfigs]);

  const getSdkForForm = (form) =>
    sdkConfigs.find((s) => s.type === form.attendeeTypeName) || null;

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h5" fontWeight={700} sx={{ color: "#1E1033" }}>
          Registrations
          <Typography component="span" variant="body2" sx={{ ml: 1.5, color: "#6B7280", fontWeight: 400 }}>
            SDK per attendee type
          </Typography>
        </Typography>
      </Box>

      {forms.length === 0 ? (
        <Box
          sx={{
            bgcolor: "#fff",
            border: "1px dashed rgba(47,26,122,0.2)",
            borderRadius: "12px",
            p: 6,
            textAlign: "center",
          }}
        >
          <AppRegistration sx={{ fontSize: 40, color: "rgba(47,26,122,0.25)", mb: 1 }} />
          <Typography variant="body2" sx={{ color: "#9CA3AF", mb: 2 }}>
            No registration forms loaded yet.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate("/app/settings")}
            sx={{
              borderRadius: "10px",
              borderColor: "rgba(47,26,122,0.3)",
              color: "#2F1A7A",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": { borderColor: "#2F1A7A", bgcolor: "rgba(47,26,122,0.06)" },
            }}
          >
            Go to Settings to Pull Forms
          </Button>
        </Box>
      ) : (
        forms.map((form) => (
          <FormRow
            key={form._id}
            form={form}
            sdkConfig={getSdkForForm(form)}
            lanBase={lanBase}
            onSaved={fetchSdkConfigs}
          />
        ))
      )}
    </Box>
  );
};

export default RegistrationsConfig;
