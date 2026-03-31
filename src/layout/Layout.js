import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  useMediaQuery,
} from "@mui/material";
import { Menu as MenuIcon, Refresh } from "@mui/icons-material";
import AdminSidebar from "./Sidebar";

const AdminLayout = () => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      {/* Fixed top header */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: 1300,
          background: "#0D0818",
          borderBottom: "1px solid rgba(32,23,81,0.2)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          height: 56,
        }}
      >
        <Toolbar sx={{ minHeight: "56px !important", px: 2, gap: "12px" }}>
          {/* Sidebar toggle */}
          <IconButton
            onClick={() => setOpen((v) => !v)}
            sx={{ color: "#6B4FC8", p: "4px", fontSize: 19, lineHeight: 1 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo mark */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "9px",
              flexShrink: 0,
              background: "linear-gradient(135deg, #201751, #6B4FC8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 16,
              color: "#fff",
              boxShadow: "0 0 14px rgba(32,23,81,0.4)",
            }}
          >
            V
          </Box>

          {/* Brand name */}
          <Box>
            <Box
              component="span"
              sx={{
                color: "#E8F4FF",
                fontWeight: 800,
                fontSize: "14px",
                fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
              }}
            >
              EventDesk
            </Box>
            <Box
              component="span"
              sx={{
                color: "#6B4FC8",
                fontSize: "9px",
                textTransform: "uppercase",
                letterSpacing: "2px",
                fontWeight: 700,
                ml: "6px",
                fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
              }}
            >
              by vosmos
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Reload */}
          <IconButton
            onClick={() => window.location.reload()}
            sx={{
              color: "#6B4FC8",
              border: "1px solid rgba(32,23,81,0.3)",
              borderRadius: "8px",
              p: "6px",
              "&:hover": {
                background: "rgba(32,23,81,0.12)",
                borderColor: "rgba(32,23,81,0.6)",
              },
            }}
          >
            <Refresh sx={{ fontSize: 18 }} />
          </IconButton>

        </Toolbar>
      </AppBar>

      <AdminSidebar open={open} onToggle={() => setOpen((v) => !v)} />

      {/* Backdrop — closes sidebar on mobile when tapped */}
      {isMobile && open && (
        <Box
          onClick={() => setOpen(false)}
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.4)",
            zIndex: 1199,
          }}
        />
      )}

      <Box
        sx={{
          ml: open && !isMobile ? "240px" : 0,
          minHeight: "100vh",
          width: "100%",
          backgroundColor: (theme) => `${theme.palette.primary.main}10`,
          flexGrow: 1,
          px: 3,
          pb: 3,
          pt: "72px",
          overflowY: "auto",
          transition: "margin-left 0.2s ease",
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default AdminLayout;
