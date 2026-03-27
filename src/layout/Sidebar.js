import { NavLink, useLocation } from "react-router-dom";
import {
  Dashboard,
  People,
  Settings,
  Print,
  LockReset,
  AppRegistration,
} from "@mui/icons-material";
import { Box } from "@mui/material";
import { apiActivation, method } from "../apiPath";
import useApiNew from "../hooks/useApi";
import keyNames from "../keyName";

const ACCENT = "#2F1A7A";

const sections = [
  {
    label: "Main",
    color: ACCENT,
    items: [
      { label: "Dashboard", link: "/app", icon: Dashboard, exact: true },
    ],
  },
  {
    label: "Management",
    color: "#6B4FC8",
    items: [
      { label: "Delegates", link: "/app/delegates", icon: People },
      { label: "Registrations", link: "/app/registrations", icon: AppRegistration },
    ],
  },
  {
    label: "Operations",
    color: "#6B4FC8",
    items: [
      { label: "Scan & Print", link: "/app/scan-print", icon: Print },
      { label: "Settings", link: "/app/settings", icon: Settings },
    ],
  },
];

const NavItem = ({ label, link, icon: Icon, exact }) => {
  const location = useLocation();
  const isActive = exact
    ? location.pathname === link
    : location.pathname.startsWith(link);

  return (
    <NavLink to={link} style={{ textDecoration: "none" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          px: "12px",
          py: "8px",
          mx: "0px",
          mr: "6px",
          borderRadius: "0 8px 8px 0",
          borderLeft: isActive
            ? "3px solid rgba(255,255,255,0.45)"
            : "3px solid transparent",
          background: isActive
            ? "linear-gradient(90deg, rgba(47,26,122,0.82), rgba(107,79,200,0.56))"
            : "transparent",
          cursor: "pointer",
          transition: "all 0.15s",
          "&:hover": !isActive
            ? {
                background: "rgba(47,26,122,0.1)",
                borderLeftColor: "rgba(47,26,122,0.35)",
              }
            : {},
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isActive
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.06)",
            border: isActive
              ? "1px solid rgba(255,255,255,0.28)"
              : "1px solid rgba(255,255,255,0.07)",
            color: isActive ? "#fff" : "#6A98B4",
            transition: "all 0.15s",
          }}
        >
          <Icon sx={{ fontSize: 14 }} />
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: "13px",
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "#fff" : "#9DC0D4",
            flex: 1,
            letterSpacing: "-0.15px",
            fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
          }}
        >
          {label}
        </Box>
        {isActive && (
          <Box
            sx={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              flexShrink: 0,
              background: "rgba(255,255,255,0.9)",
              boxShadow: "0 0 7px rgba(255,255,255,0.7)",
            }}
          />
        )}
      </Box>
    </NavLink>
  );
};


const AdminSidebar = ({ open }) => {
  const hitApi = useApiNew();

  const handleReset = () => {
    hitApi(apiActivation, null, method.delete, keyNames.activationData, null);
  };

  return (
    <Box
      sx={{
        position: "fixed",
        top: 56,
        left: 0,
        width: 248,
        height: "calc(100% - 56px)",
        background: "#050A12",
        borderRight: "1px solid rgba(255,255,255,0.09)",
        display: "flex",
        flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 1200,
        overflowY: "auto",
        overflowX: "hidden",
        "&::-webkit-scrollbar": { width: "5px" },
        "&::-webkit-scrollbar-track": { background: "#050A12" },
        "&::-webkit-scrollbar-thumb": { background: "#1A2D40", borderRadius: "4px" },
      }}
    >
      {/* Nav sections */}
      <Box sx={{ flex: 1, pt: 1, pb: "20px" }}>
        {sections.map((section) =>
          section.items.map((item) => (
            <NavItem key={item.link} {...item} />
          ))
        )}
      </Box>

      {/* Logout */}
      <Box
        onClick={handleReset}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          px: "12px",
          py: "10px",
          mx: "8px",
          mb: "12px",
          borderRadius: "10px",
          border: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.07)",
          cursor: "pointer",
          transition: "all 0.15s",
          flexShrink: 0,
          "&:hover": {
            background: "rgba(239,68,68,0.14)",
            borderColor: "rgba(239,68,68,0.35)",
          },
        }}
      >
        <LockReset sx={{ fontSize: 16, color: "#F87171", flexShrink: 0 }} />
        <Box
          component="span"
          sx={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#F87171",
            fontFamily: '"DM Sans", "Segoe UI", system-ui, sans-serif',
          }}
        >
          Logout
        </Box>
      </Box>

      {/* Bottom accent bar */}
      <Box
        sx={{
          height: 3,
          flexShrink: 0,
          background: `linear-gradient(90deg, #2F1A7A, #6B4FC8, #2F1A7A)`,
        }}
      />
    </Box>
  );
};

export default AdminSidebar;
