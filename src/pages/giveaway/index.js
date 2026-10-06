import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  InputBase,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Refresh, Search } from "@mui/icons-material";
import axios from "axios";
import useDebounce from "../../hooks/useDebounce";
import useDirect from "../../hooks/useDirect";
import {
  apiPath,
  apiGiveaway,
  apiGiveawayAttendees,
  apiGiveawayAssign,
  apiGiveawayRevert,
  apiGiveawayFailed,
  apiGiveawaySync,
} from "../../apiPath";
import keyNames from "../../keyName";
import { getColumns } from "./columns";

const OFFLINE_MSG = "Cannot reach server. Check the network connection.";

/**
 * Giveaway — assign / revert giveaways per delegate.
 * Ported from vosmos-events-client/src/pages/giveaway. Works offline: assign/revert
 * are saved in the local DB and pushed with the rest of the data (Settings → Push to
 * cloud, or the background push); they count in the dashboard's Pending Sync.
 */
const Giveaway = () => {
  // Mobile (< 767px): card layout — every column lives in the User details cell
  const compact = useMediaQuery("(max-width:766.98px)");

  const [giveaways, setGiveaways] = useState([]);
  const [syncStatus, setSyncStatus] = useState({ pending: 0, waiting: 0, failed: [] });
  const [attendees, setAttendees] = useState({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const debouncedSearch = useDebounce(search.trim(), 350);

  const directDispatch = useDirect();
  const notify = useCallback(
    (type, description) =>
      directDispatch(
        { type, title: type === "success" ? "Success" : "Error", description, position: "top-center" },
        keyNames.toastData,
      ),
    [directDispatch],
  );

  const loadGiveaways = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiPath}${apiGiveaway}`);
      setGiveaways(data.data?.giveaways || []);
      setSyncStatus(data.data?.sync || { pending: 0, waiting: 0, failed: [] });
    } catch (err) {
      console.error("Failed to fetch giveaways:", err.message);
    }
  }, []);

  const loadAttendees = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${apiPath}${apiGiveawayAttendees}`, {
        params: {
          page: paginationModel.page + 1,
          limit: paginationModel.pageSize,
          q: debouncedSearch,
        },
      });
      setAttendees(data.data || { list: [], total: 0 });
    } catch (err) {
      console.error("Failed to fetch delegates:", err.message);
    } finally {
      setLoading(false);
    }
  }, [paginationModel, debouncedSearch]);

  const reload = useCallback(() => Promise.all([loadGiveaways(), loadAttendees()]), [loadGiveaways, loadAttendees]);

  // Push queued changes + pull cloud giveaways; quiet = no toast (page open)
  const syncWithCloud = useCallback(
    async (quiet) => {
      setSyncing(true);
      try {
        await axios.post(`${apiPath}${apiGiveawaySync}`);
        if (!quiet) notify("success", "Giveaways synced with the cloud");
      } catch (err) {
        if (!quiet) {
          const res = err.response;
          notify("error", res ? res.data?.message || `Sync failed (error ${res.status})` : OFFLINE_MSG);
        }
      } finally {
        await reload();
        setSyncing(false);
      }
    },
    [notify, reload],
  );

  // Show local data straight away, then sync with the cloud once on open
  useEffect(() => {
    loadGiveaways();
    syncWithCloud(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up the background sync (every 2 min on the server)
  useEffect(() => {
    const t = setInterval(loadGiveaways, 30 * 1000);
    return () => clearInterval(t);
  }, [loadGiveaways]);

  useEffect(() => {
    loadAttendees();
  }, [loadAttendees]);

  const change = useCallback(
    async (path, row, g, verb) => {
      setBusy(true);
      try {
        await axios.post(`${apiPath}${path}`, { giveawayId: g._id, email: row.email });
        const name = `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.email;
        notify("success", `${g.title} ${verb} ${name}`);
      } catch (err) {
        notify("error", err.response?.data?.message || OFFLINE_MSG);
      } finally {
        await reload();
        setBusy(false);
      }
    },
    [notify, reload],
  );
  const handleAssign = (row, g) => change(apiGiveawayAssign, row, g, "given to");
  const handleRevert = (row, g) => change(apiGiveawayRevert, row, g, "reverted from");

  const clearFailed = async () => {
    try {
      await axios.delete(`${apiPath}${apiGiveawayFailed}`);
    } finally {
      loadGiveaways();
    }
  };

  const rows = useMemo(
    () =>
      (attendees.list || []).map((r, i) => ({
        ...r,
        id: r._id,
        sortOrder: paginationModel.page * paginationModel.pageSize + i + 1,
      })),
    [attendees, paginationModel],
  );

  const columns = getColumns({
    giveaways,
    busy,
    onAssign: handleAssign,
    onRevert: handleRevert,
    compact,
  });

  const { pending, waiting, failed } = syncStatus;

  return (
    // Desktop: fixed-height page, grid scrolls inside. Compact: page scrolls, grid grows with its rows
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: compact ? "auto" : "calc(100vh - 96px)",
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Giveaway</Typography>
            <Typography sx={{ fontSize: 13, color: "#6b7280", mt: 0.3 }}>
              Assign giveaways to delegates — works offline, syncs with the cloud
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {pending > 0 && (
              <Tooltip
                title={
                  waiting > 0
                    ? `${waiting} waiting for the delegate's registration to reach the cloud`
                    : "Saved on this PC — push from Settings → Push to cloud"
                }
              >
                <Chip
                  size="small"
                  label={`${pending} not synced`}
                  sx={{ fontSize: 11, fontWeight: 600, color: "#A16207", background: "#FEF9C3" }}
                />
              </Tooltip>
            )}
            {failed.length > 0 && (
              <Tooltip
                title={
                  <Box>
                    {failed.slice(0, 8).map((f) => (
                      <div key={f.id}>
                        {f.action} {f.title || "giveaway"} · {f.email}: {f.error}
                      </div>
                    ))}
                    {failed.length > 8 && <div>…and {failed.length - 8} more</div>}
                    <div style={{ marginTop: 4 }}>Click to dismiss</div>
                  </Box>
                }
              >
                <Chip
                  size="small"
                  label={`${failed.length} rejected by cloud`}
                  onClick={clearFailed}
                  sx={{ fontSize: 11, fontWeight: 600, color: "#dc2626", background: "#fee2e2" }}
                />
              </Tooltip>
            )}
            <Button
              size="small"
              variant="outlined"
              onClick={() => syncWithCloud(false)}
              disabled={syncing}
              startIcon={syncing ? <CircularProgress size={14} /> : <Refresh />}
              sx={{ textTransform: "none", fontSize: 12, whiteSpace: "nowrap" }}
            >
              {syncing ? "Syncing…" : "Refresh"}
            </Button>
          </Box>
        </Box>
        {/* Stock summary */}
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1.25 }}>
          {giveaways.map((g) => (
            <Chip
              key={g._id}
              size="small"
              label={`${g.title}: ${g.remainingQuantity} / ${g.totalQuantity} left`}
              sx={{
                fontSize: 11,
                fontWeight: 600,
                background: g.remainingQuantity > 0 ? "rgba(32,23,81,0.06)" : "#fee2e2",
                color: g.remainingQuantity > 0 ? "#201751" : "#dc2626",
              }}
            />
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          flex: compact ? "none" : 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          border: "1px solid rgba(32,23,81,0.1)",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(32,23,81,0.07)" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              height: 36,
              maxWidth: { xs: "100%", sm: 420 },
              border: "1px solid rgba(32,23,81,0.15)",
              borderRadius: 1.5,
            }}
          >
            <Search sx={{ fontSize: 18, color: "#9ca3af" }} />
            <InputBase
              fullWidth
              placeholder="Search by name, email, organization, designation…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPaginationModel((p) => ({ ...p, page: 0 }));
              }}
              sx={{ fontSize: 13 }}
            />
          </Box>
        </Box>

        <Box sx={{ flex: compact ? "none" : 1, minHeight: 0 }}>
          <DataGrid
            rows={rows}
            columns={columns}
            rowCount={attendees.total || 0}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 20, 50]}
            loading={loading}
            autoHeight={compact}
            getRowHeight={() => "auto"}
            columnVisibilityModel={compact ? { sortOrder: false, roleId: false, giveaways: false } : {}}
            disableColumnFilter
            disableColumnMenu
            disableRowSelectionOnClick
            localeText={{ noRowsLabel: "Delegates not found" }}
            sx={{
              height: compact ? "auto" : "100%",
              border: "none",
              "& .MuiDataGrid-columnHeaders": {
                // Compact: rows read as cards, so the header row is hidden
                display: compact ? "none" : undefined,
                background: "rgba(32,23,81,0.03)",
                borderBottom: "1px solid rgba(32,23,81,0.07)",
                "& .MuiDataGrid-columnHeaderTitle": {
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6b7280",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                },
              },
              "& .MuiDataGrid-cell": {
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid rgba(32,23,81,0.05)",
                outline: "none !important",
              },
              "& .MuiDataGrid-footerContainer": { borderTop: "1px solid rgba(32,23,81,0.07)" },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Giveaway;
