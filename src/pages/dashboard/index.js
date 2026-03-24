import { useEffect } from "react";
import { useSelector } from "react-redux";
import {
  Box, Typography, Grid, Paper, LinearProgress, Chip, Skeleton,
} from "@mui/material";
import {
  People, HowToReg, PersonOff, Sync, TrendingUp,
} from "@mui/icons-material";
import useApi from "../../hooks/useApi";
import keyNames from "../../keyName";
import { apiRegistrationStats, apiSyncPendingCount, method } from "../../apiPath";

const TYPE_COLORS = {
  attendee: { bg: "#EDE9FE", bar: "#7C3AED", text: "#6D28D9" },
  speaker:  { bg: "#DBEAFE", bar: "#2563EB", text: "#1D4ED8" },
  sponsor:  { bg: "#FEF3C7", bar: "#D97706", text: "#B45309" },
  delegate: { bg: "#D1FAE5", bar: "#059669", text: "#065F46" },
  vip:      { bg: "#FCE7F3", bar: "#DB2777", text: "#9D174D" },
};
const fallback = { bg: "#F3F4F6", bar: "#6B7280", text: "#374151" };

function StatCard({ icon, label, value, sub, accent, light, loading }) {
  return (
    <Paper elevation={0} sx={{
      p: 2.5,
      borderRadius: "14px",
      background: light,
      border: `1px solid ${accent}22`,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      minHeight: 110,
    }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {label}
        </Typography>
        <Box sx={{ opacity: 0.75 }}>{icon}</Box>
      </Box>
      {loading ? (
        <Skeleton variant="text" width={80} height={48} sx={{ bgcolor: `${accent}22` }} />
      ) : (
        <Box>
          <Typography sx={{ fontSize: "2rem", fontWeight: 900, color: "#0F0A1E", lineHeight: 1 }}>
            {value ?? "—"}
          </Typography>
          {sub && (
            <Typography sx={{ fontSize: "0.7rem", color: accent, mt: 0.3, fontWeight: 600 }}>
              {sub}
            </Typography>
          )}
        </Box>
      )}
    </Paper>
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

  return (
    <Box sx={{ m: -3, bgcolor: "#F8F7FC", minHeight: "100vh" }}>

      {/* Header */}
      <Box sx={{
        px: 3, py: 2.5,
        bgcolor: "#fff",
        borderBottom: "1px solid #EDE9FE",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F0A1E", lineHeight: 1.2 }}>
            Event Dashboard
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "#9CA3AF", mt: 0.2 }}>
            Live overview
          </Typography>
        </Box>
        {expiryLabel && (
          <Chip
            label={`Expires ${expiryLabel}`}
            size="small"
            sx={{ bgcolor: "#FEF3C7", color: "#B45309", fontSize: "0.68rem", fontWeight: 600, border: "1px solid #FDE68A" }}
          />
        )}
      </Box>

      <Box sx={{ p: 2 }}>

        {/* Stat Cards */}
        <Grid container spacing={1.5} mb={2}>
          <Grid item xs={6} md={3}>
            <StatCard
              icon={<People sx={{ color: "#7C3AED", fontSize: 20 }} />}
              label="Total Registered"
              value={stats?.total?.toLocaleString()}
              accent="#7C3AED" light="#F5F3FF"
              loading={loading}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              icon={<HowToReg sx={{ color: "#059669", fontSize: 20 }} />}
              label="Checked In"
              value={stats?.checkedIn?.toLocaleString()}
              sub={stats ? `${stats.checkInRate}% rate` : null}
              accent="#059669" light="#F0FDF4"
              loading={loading}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              icon={<PersonOff sx={{ color: "#DC2626", fontSize: 20 }} />}
              label="Not Checked In"
              value={stats?.notCheckedIn?.toLocaleString()}
              accent="#DC2626" light="#FFF1F2"
              loading={loading}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              icon={<Sync sx={{ color: "#2563EB", fontSize: 20 }} />}
              label="Pending Sync"
              value={String(pendingVal)}
              sub="awaiting cloud push"
              accent="#2563EB" light="#EFF6FF"
              loading={false}
            />
          </Grid>
        </Grid>

        {/* Check-in Progress */}
        <Paper elevation={0} sx={{
          p: 2, borderRadius: "14px", mb: 2,
          border: "1px solid rgba(124,58,237,0.1)",
          background: "#fff",
        }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center" gap={0.8}>
              <TrendingUp sx={{ color: "#7C3AED", fontSize: 17 }} />
              <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#111827" }}>Check-in Progress</Typography>
            </Box>
            {loading ? (
              <Skeleton width={40} height={20} />
            ) : (
              <Typography sx={{ fontWeight: 900, fontSize: "1.05rem", color: "#7C3AED" }}>
                {stats?.checkInRate ?? 0}%
              </Typography>
            )}
          </Box>
          <LinearProgress
            variant={loading ? "indeterminate" : "determinate"}
            value={stats?.checkInRate ?? 0}
            sx={{
              height: 8, borderRadius: 4,
              bgcolor: "rgba(124,58,237,0.08)",
              "& .MuiLinearProgress-bar": {
                borderRadius: 4,
                background: "linear-gradient(90deg, #7C3AED, #A78BFA)",
              },
            }}
          />
          {!loading && (
            <Box display="flex" justifyContent="space-between" mt={0.8}>
              <Typography sx={{ fontSize: "0.68rem", color: "#9CA3AF" }}>{stats?.checkedIn?.toLocaleString()} in</Typography>
              <Typography sx={{ fontSize: "0.68rem", color: "#9CA3AF" }}>{stats?.notCheckedIn?.toLocaleString()} remaining</Typography>
            </Box>
          )}
        </Paper>

        {/* By Type */}
        <Paper elevation={0} sx={{
          p: 2, borderRadius: "14px",
          border: "1px solid rgba(124,58,237,0.1)",
          background: "#fff",
        }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#111827", mb: 1.5 }}>
            Breakdown by Type
          </Typography>

          {loading ? (
            <Grid container spacing={1}>
              {[1, 2, 3, 4].map((i) => (
                <Grid item xs={6} key={i}>
                  <Skeleton height={68} sx={{ borderRadius: 2 }} />
                </Grid>
              ))}
            </Grid>
          ) : stats?.byType?.length ? (
            <Grid container spacing={1.5}>
              {stats.byType.map((row) => {
                const c = TYPE_COLORS[row.type] || fallback;
                const rate = row.total > 0 ? Math.round((row.checkedIn / row.total) * 100) : 0;
                return (
                  <Grid item xs={12} sm={6} key={row.type}>
                    <Box sx={{ p: 1.5, borderRadius: "10px", background: c.bg }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.8}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: c.text, textTransform: "capitalize" }}>
                          {row.type}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography sx={{ fontSize: "0.68rem", color: c.text, opacity: 0.7 }}>
                            {row.checkedIn}/{row.total}
                          </Typography>
                          <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: c.text }}>
                            {rate}%
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={rate}
                        sx={{
                          height: 5, borderRadius: 3,
                          bgcolor: "rgba(255,255,255,0.5)",
                          "& .MuiLinearProgress-bar": { borderRadius: 3, bgcolor: c.bar },
                        }}
                      />
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Typography sx={{ fontSize: "0.78rem", color: "#9CA3AF", textAlign: "center", py: 2 }}>
              No data yet
            </Typography>
          )}
        </Paper>

      </Box>
    </Box>
  );
};

export default Dashboard;
