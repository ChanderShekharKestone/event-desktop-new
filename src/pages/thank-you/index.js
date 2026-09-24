import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import { CheckCircle } from "@mui/icons-material";

// Seconds before returning to a fresh registration form (for shared kiosk/LAN devices)
const REDIRECT_SECONDS = 10;

const ThankYou = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const type = new URLSearchParams(location.search).get("type") || "attendee";
  const registerPath = `/register?type=${encodeURIComponent(type)}`;
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (seconds <= 0) {
      navigate(registerPath, { replace: true });
      return;
    }
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds, navigate, registerPath]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#F7F6FB",
        px: 2,
      }}
    >
      <Box
        sx={{
          bgcolor: "#fff",
          borderRadius: "12px",
          border: "1px solid rgba(32,23,81,0.12)",
          p: { xs: 4, sm: 6 },
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
        }}
      >
        <CheckCircle sx={{ fontSize: 72, color: "#16A34A", mb: 2 }} />
        <Typography variant="h5" fontWeight={700} sx={{ color: "#201751", mb: 1 }}>
          Thank you for registering!
        </Typography>
        <Typography variant="body1" sx={{ color: "#6B7280", mb: 4 }}>
          Your registration has been received successfully.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate(registerPath, { replace: true })}
          sx={{
            bgcolor: "#201751",
            borderRadius: "10px",
            px: 4,
            py: 1.25,
            fontWeight: 600,
            textTransform: "none",
            "&:hover": { bgcolor: "#2d2170" },
          }}
        >
          Register another
        </Button>
        <Typography variant="caption" display="block" sx={{ color: "#9CA3AF", mt: 2 }}>
          Returning to the registration form in {seconds}s
        </Typography>
      </Box>
    </Box>
  );
};

export default ThankYou;
