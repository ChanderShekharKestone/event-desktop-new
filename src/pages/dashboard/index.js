import { useEffect } from "react";
import { useSelector } from "react-redux";
import { Box, Typography, LinearProgress, Skeleton, Chip } from "@mui/material";
import { TrendingUp, AccessTime } from "@mui/icons-material";
import useApi from "../../hooks/useApi";
import keyNames from "../../keyName";
import { apiRegistrationStats, apiSyncPendingCount, method } from "../../apiPath";

const TYPE_COLORS = {
  attendee: { from: "#2F1A7A", to: "#6B4FC8", text: "#2F1A7A", soft: "#F0EEFF" },
  speaker:  { from: "#2563EB", to: "#60A5FA", text: "#2563EB", soft: "#EFF6FF" },
  sponsor:  { from: "#D97706", to: "#FCD34D", text: "#D97706", soft: "#FFFBEB" },
  delegate: { from: "#059669", to: "#34D399", text: "#059669", soft: "#ECFDF5" },
  vip:      { from: "#DB2777", to: "#F472B6", text: "#DB2777", soft: "#FDF2F8" },
};
const fallback = { from: "#6B7280", to: "#9CA3AF", text: "#6B7280", soft: "#F9FAFB" };

const STATS = (stats, pendingVal, checkInRate) => [
  { label: "Registered",   value: stats?.total?.toLocaleString(),        sub: null,              color: "#2F1A7A" },
  { label: "Checked In",   value: stats?.checkedIn?.toLocaleString(),    sub: `${checkInRate}% rate`, color: "#059669" },
  { label: "Not Arrived",  value: stats?.notCheckedIn?.toLocaleString(), sub: null,              color: "#DC2626" },
  { label: "Pending Sync", value: String(pendingVal),                    sub: "awaiting push",   color: "#2563EB" },
];

function StatCard({ label, value, sub, color, loading }) {
  return (
    <Box
      sx={{
        flex: "1 1 0",
        bgcolor: "#fff",
        border: "1px solid rgba(47,26,122,0.1)",
        borderRadius: "12px",
        px: 2.5,
        py: 2,
        display: "flex",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "10px",
          bgcolor: `${color}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {loading ? (
          <Skeleton width={28} height={28} />
        ) : (
          <Typography sx={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>
            {value ?? "—"}
          </Typography>
        )}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#6B7280", lineHeight: 1.3 }}>
          {label}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: 11, fontWeight: 600, color, mt: 0.4 }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function TypeRow({ row }) {
  const c = TYPE_COLORS[row.type] || fallback;
  const rate = row.total > 0 ? Math.round((row.checkedIn / row.total) * 100) : 0;
  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.9}>
        <Box display="flex" alignItems="center" gap={1}>
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: `linear-gradient(135deg,${c.from},${c.to})`, flexShrink: 0 }} />
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#374151", textTransform: "capitalize" }}>
            {row.type}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <Typography sx={{ fontSize: "0.72rem", color: "#9CA3AF" }}>
            {row.checkedIn.toLocaleString()} / {row.total.toLocaleString()}
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: c.text, minWidth: 30, textAlign: "right" }}>
            {rate}%
          </Typography>
        </Box>
      </Box>
      <LinearProgress
        variant="determinate"
        value={rate}
        sx={{
          height: 5, borderRadius: 3, bgcolor: c.soft,
          "& .MuiLinearProgress-bar": { borderRadius: 3, background: `linear-gradient(90deg,${c.from},${c.to})` },
        }}
      />
    </Box>
  );
}

const Dashboard = () => {
  const hitApi = useApi();
  const { dashboardStats, syncPendingCount, activationData } = useSelector((s) => s.mainReducer);
  const stats = dashboardStats;
  const loading = !stats;

  useEffect(() => {
    hitApi(apiRegistrationStats, null, method.get, keyNames.dashboardStats, null);
    hitApi(apiSyncPendingCount, null, method.get, keyNames.syncPendingCount, null);
  }, [hitApi]);

  const expiresAt = activationData?.expiresAt;
  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : null;

  const pendingVal = syncPendingCount?.count ?? syncPendingCount ?? 0;
  const checkInRate = stats?.checkInRate ?? 0;

  return (
    <Box sx={{ m: -3, minHeight: "100vh", bgcolor: "#F5F3FB" }}>

      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2.5, bgcolor: "#fff", borderBottom: "1px solid #EEEBF8" }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: "0.62rem", fontWeight: 700, color: "#6B4FC8", textTransform: "uppercase", letterSpacing: "0.14em", mb: 0.4 }}>
              Live Overview
            </Typography>
            <Typography sx={{ fontSize: "1.3rem", fontWeight: 800, color: "#1A0B3B", letterSpacing: "-0.01em" }}>
              Event Dashboard
            </Typography>
          </Box>
          {expiryLabel && (
            <Chip
              icon={<AccessTime sx={{ fontSize: "11px !important", color: "#D97706 !important" }} />}
              label={`Expires ${expiryLabel}`}
              size="small"
              sx={{ bgcolor: "#FFFBEB", color: "#B45309", fontSize: "0.63rem", fontWeight: 600, border: "1px solid #FDE68A", "& .MuiChip-icon": { ml: "6px" } }}
            />
          )}
        </Box>
      </Box>

      <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2.5 }}>

        {/* Stat Cards — first */}
        <Box display="flex" gap={1.5}>
          {STATS(stats, pendingVal, checkInRate).map((s) => (
            <StatCard key={s.label} {...s} loading={loading && s.label !== "Pending Sync"} />
          ))}
        </Box>

        {/* Check-in Progress */}
        <Box sx={{ bgcolor: "#fff", borderRadius: "14px", px: 2.5, py: 2, border: "1px solid #EEEBF8", boxShadow: "0 1px 8px rgba(47,26,122,0.05)" }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.2}>
            <Box display="flex" alignItems="center" gap={0.8}>
              <TrendingUp sx={{ color: "#2F1A7A", fontSize: 16 }} />
              <Typography sx={{ fontSize: "0.76rem", fontWeight: 700, color: "#374151" }}>Check-in Progress</Typography>
            </Box>
            {loading
              ? <Skeleton width={36} height={22} />
              : <Typography sx={{ fontSize: "1.2rem", fontWeight: 900, color: "#2F1A7A", letterSpacing: "-0.02em" }}>{checkInRate}%</Typography>
            }
          </Box>
          <LinearProgress
            variant={loading ? "indeterminate" : "determinate"}
            value={checkInRate}
            sx={{
              height: 6, borderRadius: 3, bgcolor: "#E5DEFF",
              "& .MuiLinearProgress-bar": { borderRadius: 3, background: "linear-gradient(90deg,#2F1A7A,#6B4FC8)" },
            }}
          />
          {!loading && (
            <Box display="flex" justifyContent="space-between" mt={0.8}>
              <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF" }}>{stats?.checkedIn?.toLocaleString()} arrived</Typography>
              <Typography sx={{ fontSize: "0.65rem", color: "#9CA3AF" }}>{stats?.notCheckedIn?.toLocaleString()} remaining</Typography>
            </Box>
          )}
        </Box>

        {/* Breakdown by Type */}
        <Box sx={{ bgcolor: "#fff", borderRadius: "14px", p: 2.5, border: "1px solid #EEEBF8" }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#1A0B3B", mb: 2 }}>
            Breakdown by Type
          </Typography>
          {loading ? (
            <Box display="flex" flexDirection="column" gap={2.5}>
              {[1, 2, 3].map((i) => (
                <Box key={i}>
                  <Box display="flex" justifyContent="space-between" mb={0.9}><Skeleton width={80} height={14} /><Skeleton width={40} height={14} /></Box>
                  <Skeleton height={5} sx={{ borderRadius: 3 }} />
                </Box>
              ))}
            </Box>
          ) : stats?.byType?.length ? (
            <Box display="flex" flexDirection="column" gap={2.5}>
              {stats.byType.map((row) => <TypeRow key={row.type} row={row} />)}
            </Box>
          ) : (
            <Box textAlign="center" py={3}>
              <Typography sx={{ fontSize: "0.8rem", color: "#C4B5FD" }}>No data yet</Typography>
            </Box>
          )}
        </Box>

      </Box>
    </Box>
  );
};

export default Dashboard;
