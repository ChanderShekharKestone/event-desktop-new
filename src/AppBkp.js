import { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  Fade,
  createTheme,
  ThemeProvider,
  CssBaseline,
} from "@mui/material";
import {
  CheckCircleOutline,
  VpnKey,
  ContentCopy,
  LockOpen,
  LockReset,
  Fingerprint,
  Shield,
} from "@mui/icons-material";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#7C3AED",
      light: "#A78BFA",
      dark: "#5B21B6",
    },
    background: {
      default: "#F5F3FF",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#1E1033",
      secondary: "#6D28D9",
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          letterSpacing: "0.02em",
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            "& fieldset": {
              borderColor: "rgba(124,58,237,0.25)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(124,58,237,0.5)",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#7C3AED",
            },
          },
        },
      },
    },
  },
});

function ActivatedView({ onReset }) {
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
            p: 6,
            maxWidth: 440,
            width: "90%",
            textAlign: "center",
            background: "#FFFFFF",
            border: "1px solid rgba(124,58,237,0.15)",
            boxShadow: "0 8px 40px rgba(124,58,237,0.12)",
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
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              boxShadow: "0 8px 24px rgba(124,58,237,0.35)",
            }}
          >
            <CheckCircleOutline sx={{ fontSize: 42, color: "#fff" }} />
          </Box>

          <Typography
            variant="h5"
            fontWeight={700}
            gutterBottom
            sx={{ color: "#1E1033" }}
          >
            Application Activated
          </Typography>
          <Typography variant="body2" sx={{ color: "#6D28D9", mb: 4 }}>
            Your license is valid and all features are unlocked.
          </Typography>

          <Chip
            icon={<Shield sx={{ fontSize: 16 }} />}
            label="License Active"
            sx={{
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.25)",
              color: "#6D28D9",
              fontWeight: 600,
              mb: 4,
              px: 1,
            }}
          />

          <Button
            variant="outlined"
            startIcon={<LockReset />}
            onClick={onReset}
            fullWidth
            sx={{
              borderColor: "rgba(124,58,237,0.35)",
              color: "#7C3AED",
              "&:hover": {
                borderColor: "#7C3AED",
                background: "rgba(124,58,237,0.06)",
              },
            }}
          >
            Reset Activation
          </Button>
        </Paper>
      </Box>
    </Fade>
  );
}

function App() {
  const [activated, setActivated] = useState(false);
  const [key, setKey] = useState("");
  const [message, setMessage] = useState("");
  const [machineId, setMachineId] = useState("");
  const [machineIdError, setMachineIdError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!window.electronAPI) return;
      const result = await window.electronAPI.checkActivation();
      setActivated(result);
    };
    init();
  }, []);

  useEffect(() => {
    const loadMachineId = async () => {
      if (!window.electronAPI) {
        setMachineIdError(true);
        return;
      }
      try {
        const id = await window.electronAPI.getMachineId();
        if (id) {
          setMachineId(id);
        } else {
          setMachineIdError(true);
        }
      } catch (err) {
        console.error("getMachineId failed:", err);
        setMachineIdError(true);
      }
    };
    loadMachineId();
  }, []);

  const activate = async () => {
    if (key === "ABC123") {
      await window.electronAPI.saveActivation();
      setActivated(true);
      setMessage("");
    } else {
      setMessage("Invalid activation key. Please check and try again.");
    }
  };

  const reset = async () => {
    if (window.electronAPI) {
      await window.electronAPI.resetActivation();
    }
    setActivated(false);
  };

  const copyMachineId = () => {
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (activated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ActivatedView onReset={reset} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
                  sx={{ color: "#1E1033", lineHeight: 1.2 }}
                >
                  Activate License
                </Typography>
                <Typography variant="caption" sx={{ color: "#7C3AED" }}>
                  Enter your key to unlock all features
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 3, borderColor: "rgba(124,58,237,0.12)" }} />

            {/* Machine ID section */}
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
                  }}
                >
                  Machine ID
                </Typography>
              </Box>

              {/* Horizontal single-line machine ID row */}
              <Box
                display="flex"
                alignItems="center"
                gap={1}
                sx={{
                  background: "#F5F3FF",
                  border: "1px solid rgba(124,58,237,0.25)",
                  borderRadius: "12px",
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
                  {machineIdError
                    ? "Unavailable — run inside Electron"
                    : machineId || "Loading..."}
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

            {/* Activation Key Input */}
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
              sx={{ mb: 2.5 }}
            />

            {message && (
              <Fade in>
                <Alert
                  severity="error"
                  sx={{
                    mb: 2.5,
                    background: "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 2,
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
    </ThemeProvider>
  );
}

export default App;
