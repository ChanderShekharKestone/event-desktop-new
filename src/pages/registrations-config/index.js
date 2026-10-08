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
  Collapse,
} from "@mui/material";
import {
  ContentCopy,
  Check,
  CloudDownload,
  FolderOpen,
  AppRegistration,
  Save,
  ExpandMore,
  Title,
} from "@mui/icons-material";
import axios from "axios";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  apiPath,
  apiSdkConfigs,
  apiRegistrationFields,
  apiFormHeadings,
} from "../../apiPath";
import keyNames from "../../keyName";
import useApi from "../../hooks/useApi";
import { method } from "../../apiPath";

const REGISTER_BASE = window.location.origin;

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "10px",
    fontSize: "0.875rem",
    "& fieldset": { borderColor: "rgba(32,23,81,0.2)" },
    "&:hover fieldset": { borderColor: "rgba(32,23,81,0.4)" },
    "&.Mui-focused fieldset": { borderColor: "#201751" },
  },
};

const getPublicPath = (sdkLocalPath) => {
  if (!sdkLocalPath) return null;
  const basename = sdkLocalPath.split(/[\\/]/).pop();
  return `/sdk-files/${basename}`;
};

const DEFAULT_SDK = "https://cdn.vosmos.live/sdk/sdk_v1.js";

const buttonSx = {
  borderRadius: "10px",
  background: "linear-gradient(135deg, #201751, #6B4FC8)",
  fontWeight: 600,
  textTransform: "none",
  whiteSpace: "nowrap",
  flexShrink: 0,
  "&:hover": { background: "linear-gradient(135deg, #231460, #9775FA)" },
  // MUI's default grey disabled text is invisible on the gradient
  "&.Mui-disabled": { color: "rgba(255,255,255,0.85)", opacity: 0.55 },
};

// Heading / subheading shown above the form on the register page. Saved locally only.
const HeadingEditor = ({ type, saved, onSaved }) => {
  const [heading, setHeading] = useState(saved?.heading || "");
  const [subheading, setSubheading] = useState(saved?.subheading || "");
  const savedCss = (saved?.cssUrls || []).join("\n");
  const [cssText, setCssText] = useState(savedCss);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setHeading(saved?.heading || "");
    setSubheading(saved?.subheading || "");
    setCssText((saved?.cssUrls || []).join("\n"));
  }, [saved]);

  const dirty =
    heading !== (saved?.heading || "") ||
    subheading !== (saved?.subheading || "") ||
    cssText !== savedCss;

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      await axios.put(
        `${apiPath}${apiFormHeadings}/${encodeURIComponent(type)}`,
        {
          heading,
          subheading,
          cssUrls: cssText
            .split("\n")
            .map((u) => u.trim())
            .filter(Boolean),
        },
      );
      setStatus("Saved");
      onSaved();
    } catch (err) {
      setStatus(err.response?.data?.message || err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inputSx = {
    ...fieldSx,
    "& .MuiOutlinedInput-root": {
      ...fieldSx["& .MuiOutlinedInput-root"],
      bgcolor: "#fff",
    },
  };

  return (
    <Box
      sx={{
        background: "linear-gradient(135deg, #e8e5f5 0%, #d4cef0 100%)",
        borderRadius: "10px",
        mb: 2,
        overflow: "hidden",
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1.25,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <Title sx={{ fontSize: 18, color: "#201751" }} />
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "#201751", flexShrink: 0 }}
        >
          Heading, Subheading & CSS
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{ color: "#4B4370", minWidth: 0, flex: 1 }}
        >
          {saved?.heading ? `— ${saved.heading}` : "— not set"}
        </Typography>
        <ExpandMore
          sx={{
            color: "#201751",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </Box>
      <Collapse in={open} unmountOnExit={false}>
        <Box
          sx={{
            px: 2,
            pb: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <TextField
            label="Form Heading"
            value={heading}
            onChange={(e) => {
              setHeading(e.target.value);
              setStatus("");
            }}
            size="small"
            fullWidth
            placeholder="e.g. Register for the Summit"
            sx={inputSx}
          />
          <TextField
            label="Form Subheading"
            value={subheading}
            onChange={(e) => {
              setSubheading(e.target.value);
              setStatus("");
            }}
            size="small"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            placeholder="e.g. Fill in your details to get your badge"
            sx={inputSx}
          />
          <TextField
            label="CSS URLs (one per line)"
            value={cssText}
            onChange={(e) => {
              setCssText(e.target.value);
              setStatus("");
            }}
            size="small"
            fullWidth
            multiline
            minRows={2}
            maxRows={5}
            placeholder="https://www.example.com/assets/form.css"
            sx={{ ...inputSx, "& textarea": { fontFamily: "monospace", fontSize: "0.8rem" } }}
          />
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.7rem",
                color: status && status !== "Saved" ? "error.main" : "#4B4370",
              }}
            >
              {status ||
                "Shown on the register page; CSS styles the form. Stays on this PC, not synced to cloud."}
            </Typography>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !dirty}
              startIcon={
                saving ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <Save />
                )
              }
              sx={{ ...buttonSx, ml: "auto" }}
            >
              {saving ? "Saving…" : "Save Heading"}
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

const FormRow = ({
  form,
  sdkConfig,
  heading,
  lanBase,
  onSaved,
  onHeadingSaved,
}) => {
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
  const lanUrl = lanBase
    ? `${lanBase}/#/register?type=${encodeURIComponent(form.attendeeTypeName)}`
    : null;

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
    if (!sdkUrl.trim()) {
      setError("SDK URL is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.attendeeTypeName,
        sdkCloudPath: sdkUrl.trim(),
        type: form.attendeeTypeName,
      };
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
        border: "1px solid rgba(32,23,81,0.12)",
        borderRadius: "12px",
        p: 2.5,
        mb: 2,
      }}
    >
      <Box display="flex" alignItems="center" gap={1.5} flexWrap="wrap" mb={2}>
        <Chip
          label={form.attendeeTypeName}
          size="small"
          sx={{
            bgcolor: "rgba(32,23,81,0.1)",
            color: "#201751",
            fontWeight: 700,
            fontSize: "0.8rem",
          }}
        />
        {form.isRegistrationPageRequired ? (
          <Chip
            label="Registration Required"
            size="small"
            sx={{
              bgcolor: "rgba(22,163,74,0.1)",
              color: "#16A34A",
              fontWeight: 600,
              fontSize: "0.72rem",
            }}
          />
        ) : (
          <Chip
            label="Optional"
            size="small"
            sx={{
              bgcolor: "rgba(156,163,175,0.15)",
              color: "#6B7280",
              fontWeight: 600,
              fontSize: "0.72rem",
            }}
          />
        )}
        <Box
          display="flex"
          flexDirection="column"
          alignItems="flex-end"
          gap={0.5}
          ml="auto"
        >
          <Box display="flex" alignItems="center" gap={0.5}>
            <Typography
              variant="caption"
              sx={{
                color: "#201751",
                fontFamily: "monospace",
                fontSize: "0.72rem",
              }}
            >
              {regUrl}
            </Typography>
            <Tooltip title={copied ? "Copied!" : "Copy local URL"}>
              <IconButton
                size="small"
                onClick={copyUrl}
                sx={{ color: "#201751" }}
              >
                {copied ? (
                  <Check sx={{ fontSize: 14 }} />
                ) : (
                  <ContentCopy sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </Tooltip>
          </Box>
          {lanUrl && (
            <Box display="flex" alignItems="center" gap={0.5}>
              <Typography
                variant="caption"
                sx={{
                  color: "#059669",
                  fontFamily: "monospace",
                  fontSize: "0.72rem",
                }}
              >
                {lanUrl}
              </Typography>
              <Tooltip title={copiedLan ? "Copied!" : "Copy LAN URL"}>
                <IconButton
                  size="small"
                  onClick={copyLanUrl}
                  sx={{ color: "#059669" }}
                >
                  {copiedLan ? (
                    <Check sx={{ fontSize: 14 }} />
                  ) : (
                    <ContentCopy sx={{ fontSize: 14 }} />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Box>

      <HeadingEditor
        type={form.attendeeTypeName}
        saved={heading}
        onSaved={onHeadingSaved}
      />

      <Box display="flex" gap={1.5} alignItems="flex-start">
        <TextField
          label="SDK Cloud URL"
          value={sdkUrl}
          onChange={(e) => {
            setSdkUrl(e.target.value);
            setError("");
          }}
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
          startIcon={
            saving ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <CloudDownload />
            )
          }
          sx={{ ...buttonSx, mt: 0.25 }}
        >
          {saving ? "Saving…" : sdkConfig ? "Update SDK" : "Save & Download"}
        </Button>
      </Box>

      <Box display="flex" alignItems="center" gap={1} mt={1.5}>
        <FolderOpen sx={{ fontSize: 15, color: "#9CA3AF" }} />
        <Typography
          variant="caption"
          sx={{
            color: "#6B7280",
            fontFamily: "monospace",
            fontSize: "0.72rem",
          }}
        >
          {sdkConfig?.sdkLocalPath
            ? getPublicPath(sdkConfig.sdkLocalPath)
            : DEFAULT_SDK}
        </Typography>
        {!sdkConfig?.sdkLocalPath && (
          <Typography
            variant="caption"
            sx={{ color: "#9CA3AF", fontSize: "0.68rem" }}
          >
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
  const [headings, setHeadings] = useState([]);

  // Load forms from local SQLite on mount (in case Redux was reset by refresh)
  useEffect(() => {
    hitApi(
      apiRegistrationFields,
      null,
      method.get,
      keyNames.registrationFormsData,
      null,
    );
  }, [hitApi]);

  const fetchSdkConfigs = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiPath}${apiSdkConfigs}`);
      setSdkConfigs(data.data || []);
    } catch (err) {
      console.error("Failed to fetch SDK configs:", err.message);
    }
  }, []);

  const fetchHeadings = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiPath}${apiFormHeadings}`);
      setHeadings(data.data || []);
    } catch (err) {
      console.error("Failed to fetch form headings:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchSdkConfigs();
    fetchHeadings();
    axios
      .get(`${apiPath}app-settings/lan-url`)
      .then(({ data }) => setLanBase(data.data))
      .catch(() => {});
  }, [fetchSdkConfigs, fetchHeadings]);

  const getSdkForForm = (form) =>
    sdkConfigs.find((s) => s.type === form.attendeeTypeName) || null;

  return (
    <Box>
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Typography variant="h5" fontWeight={700} sx={{ color: "#1E1033" }}>
          Registrations
          <Typography
            component="span"
            variant="body2"
            sx={{ ml: 1.5, color: "#6B7280", fontWeight: 400 }}
          >
            Heading & SDK per attendee type
          </Typography>
        </Typography>
      </Box>

      {forms.length === 0 ? (
        <Box
          sx={{
            bgcolor: "#fff",
            border: "1px dashed rgba(32,23,81,0.2)",
            borderRadius: "12px",
            p: 6,
            textAlign: "center",
          }}
        >
          <AppRegistration
            sx={{ fontSize: 40, color: "rgba(32,23,81,0.25)", mb: 1 }}
          />
          <Typography variant="body2" sx={{ color: "#9CA3AF", mb: 2 }}>
            No registration forms loaded yet.
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate("/app/settings")}
            sx={{
              borderRadius: "10px",
              borderColor: "rgba(32,23,81,0.3)",
              color: "#201751",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": {
                borderColor: "#201751",
                bgcolor: "rgba(32,23,81,0.06)",
              },
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
            heading={
              headings.find((h) => h.type === form.attendeeTypeName) || null
            }
            lanBase={lanBase}
            onSaved={fetchSdkConfigs}
            onHeadingSaved={fetchHeadings}
          />
        ))
      )}
    </Box>
  );
};

export default RegistrationsConfig;
