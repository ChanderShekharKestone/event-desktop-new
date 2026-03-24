import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import useApi from "../../hooks/useApi";
import keyNames from "../../keyName";
import { getToast } from "../../common/utils";
import { apiActivation, apiMachineId, method } from "../../apiPath";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
  Fade,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  LockOpen,
  VpnKey,
  Fingerprint,
  ContentCopy,
} from "@mui/icons-material";

const toast = getToast("error");

const Activate = () => {
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isExpired = location.state?.reason === "expired";
  const hitApi = useApi();
  const { activationData, machineId } = useSelector((s) => s.mainReducer);

  // Check activation and load machine ID on mount
  useEffect(() => {
    hitApi(apiActivation, null, method.get, keyNames.activationData, toast);
    hitApi(apiMachineId, null, method.get, keyNames.machineId, toast);
  }, [hitApi]);

  // Navigate when activated
  useEffect(() => {
    if (activationData?.activated === true) navigate("/app");
  }, [activationData, navigate]);

  const activate = () => {
    if (!key.trim()) {
      setMessage("Please enter an activation key.");
      return;
    }
    hitApi(
      apiActivation,
      { activationKey: key.trim() },
      method.post,
      keyNames.activationData,
      toast,
    );
  };

  const copyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Fade in>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        sx={{
          background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 5,
            maxWidth: 480,
            width: "90%",
            background: "#FFFFFF",
            border: "1px solid rgba(124,58,237,0.15)",
            boxShadow: "0 8px 40px rgba(124,58,237,0.12)",
            borderRadius: "16px",
            position: "relative",
            overflow: "hidden",
            "&::before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "3px",
              background: "linear-gradient(90deg, #7C3AED, #A78BFA, #7C3AED)",
            },
          }}
        >
          {/* Header */}
          <Box display="flex" alignItems="center" gap={2} mb={1}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
                flexShrink: 0,
              }}
            >
              <LockOpen sx={{ fontSize: 22, color: "#fff" }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{
                  color: "#1E1033",
                  lineHeight: 1.2,
                  fontFamily: '"Inter", "Roboto", sans-serif',
                }}
              >
                Activate License
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: "#7C3AED",
                  fontFamily: '"Inter", "Roboto", sans-serif',
                }}
              >
                Enter your key to unlock all features
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3, borderColor: "rgba(124,58,237,0.12)" }} />

          {/* Machine ID */}
          <Box
            sx={{
              background: "rgba(124,58,237,0.04)",
              border: "1px solid rgba(124,58,237,0.15)",
              borderRadius: "12px",
              p: 2,
              mb: 3,
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Fingerprint sx={{ fontSize: 15, color: "#7C3AED" }} />
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  color: "#7C3AED",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontFamily: '"Inter", "Roboto", sans-serif',
                }}
              >
                Machine ID
              </Typography>
            </Box>
            <Box
              display="flex"
              alignItems="center"
              gap={1}
              sx={{
                background: "#F5F3FF",
                border: "1px solid rgba(124,58,237,0.25)",
                borderRadius: "10px",
                px: 1.5,
                py: 0.75,
              }}
            >
              <Typography
                variant="body2"
                noWrap
                sx={{
                  fontFamily: "monospace",
                  color: "#1E1033",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  flex: 1,
                }}
              >
                {machineId || "Loading..."}
              </Typography>
              <Tooltip title={copied ? "Copied!" : "Copy"} placement="top">
                <IconButton
                  size="small"
                  onClick={copyMachineId}
                  disabled={!machineId}
                  sx={{
                    color: copied ? "#059669" : "#7C3AED",
                    background: copied
                      ? "rgba(5,150,105,0.08)"
                      : "rgba(124,58,237,0.08)",
                    "&:hover": { background: "rgba(124,58,237,0.15)" },
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                  }}
                >
                  <ContentCopy sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Expiry warning */}
          {isExpired && (
            <Alert
              severity="warning"
              sx={{
                mb: 2.5,
                borderRadius: "10px",
                fontFamily: '"Inter", "Roboto", sans-serif',
              }}
            >
              Your activation has expired. Please enter your key again to
              continue.
            </Alert>
          )}

          {/* Key Input */}
          <TextField
            fullWidth
            placeholder="Enter activation key"
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setMessage("");
            }}
            onKeyDown={(e) => e.key === "Enter" && activate()}
            slotProps={{
              input: {
                startAdornment: (
                  <VpnKey sx={{ color: "#7C3AED", mr: 1, fontSize: 20 }} />
                ),
              },
            }}
            sx={{
              mb: 2.5,
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
                fontFamily: '"Inter", "Roboto", sans-serif',
                "& fieldset": { borderColor: "rgba(124,58,237,0.25)" },
                "&:hover fieldset": { borderColor: "rgba(124,58,237,0.5)" },
                "&.Mui-focused fieldset": { borderColor: "#7C3AED" },
              },
            }}
          />

          {message && (
            <Fade in>
              <Alert
                severity="error"
                sx={{
                  mb: 2.5,
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "10px",
                  fontFamily: '"Inter", "Roboto", sans-serif',
                  "& .MuiAlert-icon": { color: "#DC2626" },
                }}
              >
                {message}
              </Alert>
            </Fade>
          )}

          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={activate}
            sx={{
              py: 1.5,
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              fontFamily: '"Inter", "Roboto", sans-serif',
              background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
              boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #6D28D9, #5B21B6)",
                boxShadow: "0 6px 28px rgba(124,58,237,0.5)",
                transform: "translateY(-1px)",
              },
              transition: "all 0.2s ease",
            }}
          >
            Activate License
          </Button>
        </Paper>
      </Box>
    </Fade>
  );
};

export default Activate;
