import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Chip,
  TextField,
  Button,
  InputAdornment,
  CircularProgress,
  Avatar,
  Tooltip,
  IconButton,
  Select,
  MenuItem,
  FormControl,
} from "@mui/material";
import { Search, FileDownload, Done, Print } from "@mui/icons-material";
import { DataGrid, useGridApiRef } from "@mui/x-data-grid";
import axios from "axios";
import { useSelector } from "react-redux";
import useDebounce from "../../hooks/useDebounce";
import { apiPath, apiGetRegistrations, apiUserScan } from "../../apiPath";
import PrintableBadgeModal from "./PrintableBadgeModal";

function getInitials(firstName = "", lastName = "") {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

function avatarColor(name = "") {
  const colors = ["#2F1A7A", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const Delegates = () => {
  const apiRef = useGridApiRef();
  const { badgeTemplatesData, attendeeTypesData } = useSelector((s) => s.mainReducer);
  const attendeeTypes = attendeeTypesData?.data || attendeeTypesData || [];

  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState([{ field: "createdAt", sort: "desc" }]);
  const [exporting, setExporting] = useState(false);
  const [openBadge, setOpenBadge] = useState(null);
  const debouncedSearch = useDebounce(search, 400);

  const fetchDelegates = useCallback(async () => {
    setLoading(true);
    try {
      const { page, pageSize } = paginationModel;
      const sort = sortModel[0]?.field || "createdAt";
      const order = sortModel[0]?.sort || "desc";
      const { data } = await axios.get(`${apiPath}${apiGetRegistrations}`, {
        params: { page: page + 1, limit: pageSize, search: debouncedSearch, sort, order, type: typeFilter },
      });
      setRows((data.data || []).map((r, i) => ({ ...r, id: r._id ?? i })));
      setRowCount(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch delegates:", err.message);
    } finally {
      setLoading(false);
    }
  }, [paginationModel, sortModel, debouncedSearch, typeFilter]);

  useEffect(() => { fetchDelegates(); }, [fetchDelegates]);
  useEffect(() => { setPaginationModel((prev) => ({ ...prev, page: 0 })); }, [debouncedSearch, typeFilter]);

  const markAttendance = useCallback(async (row) => {
    try {
      await axios.post(`${apiPath}${apiUserScan}`, {
        id: row._id || row.id,
        isCheckedIn: true,
        checkedInTime: new Date().toISOString(),
        isPrintClicked: false,
      });
      fetchDelegates();
    } catch (err) {
      console.error("Mark attendance failed:", err.message);
    }
  }, [fetchDelegates]);

  const handleExportAll = useCallback(async () => {
    setExporting(true);
    try {
      const sort = sortModel[0]?.field || "createdAt";
      const order = sortModel[0]?.sort || "desc";
      const { data } = await axios.get(`${apiPath}${apiGetRegistrations}`, {
        params: { page: 1, limit: rowCount || 100000, search: debouncedSearch, sort, order },
      });
      const all = data.data || [];
      const headers = ["#", "First Name", "Last Name", "Email", "Mobile", "Organization", "Designation", "Checked In", "Registered At"];
      const csvRows = [
        headers.join(","),
        ...all.map((r, i) =>
          [i + 1, r.firstName, r.lastName, r.email, r.mobile, r.organization, r.designation, r.isCheckedIn ? "Yes" : "No", r.createdAt ? new Date(r.createdAt).toLocaleString() : ""]
            .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
            .join(",")
        ),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `delegates-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err.message);
    } finally {
      setExporting(false);
    }
  }, [rowCount, debouncedSearch, sortModel]);

  const columns = [
    {
      field: "_seq",
      headerName: "#",
      width: 52,
      sortable: false,
      renderCell: ({ api, row }) => {
        const idx = api.getAllRowIds().indexOf(row.id);
        return (
          <Box display="flex" alignItems="center" height="100%">
            <Typography sx={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>
              {paginationModel.page * paginationModel.pageSize + idx + 1}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "checkedInStatus",
      headerName: "Status",
      width: 130,
      sortable: false,
      renderCell: ({ row }) => (
        <Box display="flex" flexDirection="column" gap={0.5} justifyContent="center" height="100%">
          <Chip
            label={row.isCheckedIn ? "Checked In" : "Not Checked In"}
            size="small"
            sx={{
              bgcolor: row.isCheckedIn ? "rgba(22,163,74,0.08)" : "rgba(239,68,68,0.08)",
              color: row.isCheckedIn ? "#16A34A" : "#DC2626",
              fontWeight: 600,
              fontSize: "0.7rem",
              height: 20,
              borderRadius: "5px",
            }}
          />
        </Box>
      ),
    },
    {
      field: "personalInfo",
      headerName: "Personal Info",
      flex: 1,
      minWidth: 220,
      sortable: false,
      renderCell: ({ row }) => {
        const name = `${row.firstName || ""} ${row.lastName || ""}`.trim();
        const color = avatarColor(name);
        return (
          <Box display="flex" alignItems="center" gap={1.5} height="100%">
            <Avatar sx={{ width: 34, height: 34, bgcolor: color, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {getInitials(row.firstName, row.lastName)}
            </Avatar>
            <Box minWidth={0}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {name || "—"}
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {row.email}
              </Typography>
              {row.mobile && (
                <Typography sx={{ fontSize: 11, color: "#9CA3AF" }}>{row.mobile}</Typography>
              )}
            </Box>
          </Box>
        );
      },
    },
    {
      field: "professionalInfo",
      headerName: "Professional Info",
      width: 180,
      sortable: false,
      renderCell: ({ row }) => (
        <Box display="flex" flexDirection="column" justifyContent="center" height="100%" gap={0.3}>
          {row.organization && (
            <Typography sx={{ fontSize: 12, color: "#374151" }}>
              <Typography component="span" sx={{ fontSize: 11, color: "#9CA3AF", mr: 0.5 }}>Org:</Typography>
              {row.organization}
            </Typography>
          )}
          {row.designation && (
            <Typography sx={{ fontSize: 12, color: "#374151" }}>
              <Typography component="span" sx={{ fontSize: 11, color: "#9CA3AF", mr: 0.5 }}>Desg:</Typography>
              {row.designation}
            </Typography>
          )}
          {!row.organization && !row.designation && (
            <Typography sx={{ fontSize: 12, color: "#D1D5DB" }}>—</Typography>
          )}
        </Box>
      ),
    },
    {
      field: "type",
      headerName: "Type",
      width: 110,
      sortable: false,
      renderCell: ({ value }) => {
        const TYPE_COLORS = {
          attendee: { bg: "rgba(47,26,122,0.08)", color: "#2F1A7A" },
          speaker:  { bg: "rgba(37,99,235,0.08)",  color: "#2563EB" },
          sponsor:  { bg: "rgba(217,119,6,0.08)",  color: "#D97706" },
          delegate: { bg: "rgba(5,150,105,0.08)",  color: "#059669" },
          vip:      { bg: "rgba(219,39,119,0.08)", color: "#DB2777" },
        };
        const t = (value || "attendee").toLowerCase();
        const c = TYPE_COLORS[t] || { bg: "rgba(107,114,128,0.08)", color: "#6B7280" };
        return (
          <Box display="flex" alignItems="center" height="100%">
            <Chip
              label={t}
              size="small"
              sx={{ bgcolor: c.bg, color: c.color, fontWeight: 600, fontSize: "0.7rem", height: 20, borderRadius: "5px", textTransform: "capitalize" }}
            />
          </Box>
        );
      },
    },
    {
      field: "campaignSource",
      headerName: "Source",
      width: 110,
      sortable: false,
      renderCell: ({ value }) => (
        <Box display="flex" alignItems="center" height="100%">
          <Chip
            label={value || "Direct"}
            size="small"
            sx={{ bgcolor: "rgba(14,165,233,0.08)", color: "#0369A1", fontWeight: 600, fontSize: "0.7rem", height: 20, borderRadius: "5px" }}
          />
        </Box>
      ),
    },
    {
      field: "isPrintClicked",
      headerName: "Printed",
      width: 90,
      sortable: false,
      renderCell: ({ value }) => (
        <Box display="flex" alignItems="center" height="100%">
          <Chip
            label={value ? "Yes" : "No"}
            size="small"
            sx={{
              bgcolor: value ? "rgba(22,163,74,0.08)" : "rgba(156,163,175,0.1)",
              color: value ? "#16A34A" : "#9CA3AF",
              fontWeight: 600,
              fontSize: "0.7rem",
              height: 20,
              borderRadius: "5px",
            }}
          />
        </Box>
      ),
    },
    {
      field: "createdAt",
      headerName: "Registered On",
      width: 180,
      renderCell: ({ value }) => {
        if (!value) return <Box display="flex" alignItems="center" height="100%"><Typography sx={{ fontSize: 12, color: "#9CA3AF" }}>—</Typography></Box>;
        const d = new Date(value);
        return (
          <Box display="flex" flexDirection="column" justifyContent="center" height="100%">
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              {d.toLocaleDateString("en-CA")}
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#9CA3AF" }}>
              {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Typography>
          </Box>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 90,
      sortable: false,
      renderCell: ({ row }) => (
        <Box display="flex" alignItems="center" height="100%" gap={0.75}>
          <Tooltip title={row.isCheckedIn ? "Already Checked In" : "Mark Attendance"}>
            <span>
              <IconButton
                size="small"
                onClick={() => markAttendance(row)}
                disabled={row.isCheckedIn}
                sx={{
                  width: 30, height: 30, borderRadius: "7px",
                  bgcolor: "rgba(47,26,122,0.08)", color: "#2F1A7A",
                  "&:hover": { bgcolor: "rgba(47,26,122,0.16)" },
                  "&.Mui-disabled": { bgcolor: "rgba(47,26,122,0.04)", color: "rgba(47,26,122,0.25)" },
                }}
              >
                <Done sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={badgeTemplatesData?.length ? "Print Badge" : "No badge templates"}>
            <span>
              <IconButton
                size="small"
                onClick={() => setOpenBadge(row)}
                disabled={!badgeTemplatesData?.length}
                sx={{
                  width: 30, height: 30, borderRadius: "7px",
                  bgcolor: "rgba(47,26,122,0.08)", color: "#2F1A7A",
                  "&:hover": { bgcolor: "rgba(47,26,122,0.16)" },
                  "&.Mui-disabled": { bgcolor: "rgba(47,26,122,0.04)", color: "rgba(47,26,122,0.25)" },
                }}
              >
                <Print sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      {openBadge && badgeTemplatesData?.length > 0 && (
        <PrintableBadgeModal
          userInfo={openBadge}
          onClose={() => { setOpenBadge(null); fetchDelegates(); }}
          badgeData={badgeTemplatesData}
        />
      )}

      {/* Card */}
      <Box sx={{ bgcolor: "#fff", borderRadius: "14px", border: "1px solid rgba(47,26,122,0.1)", overflow: "hidden" }}>

        {/* Header */}
        <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
              Delegates List
            </Typography>
            <Box sx={{ px: 1.5, py: 0.25, bgcolor: "rgba(47,26,122,0.08)", borderRadius: "20px" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#2F1A7A" }}>
                {rowCount}
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1.5} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: "8px",
                  fontSize: 13,
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(0,0,0,0.1)" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(47,26,122,0.3)" },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#2F1A7A" },
                }}
              >
                <MenuItem value="">All Types</MenuItem>
                {attendeeTypes.map((t) => (
                  <MenuItem key={t._id} value={t.name} sx={{ textTransform: "capitalize", fontSize: 13 }}>
                    {t.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              placeholder="Search name, email, org…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 16, color: "#9CA3AF" }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                width: 240,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  fontSize: 13,
                  "& fieldset": { borderColor: "rgba(0,0,0,0.1)" },
                  "&:hover fieldset": { borderColor: "rgba(47,26,122,0.3)" },
                  "&.Mui-focused fieldset": { borderColor: "#2F1A7A" },
                },
              }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={exporting ? <CircularProgress size={13} color="inherit" /> : <FileDownload sx={{ fontSize: 16 }} />}
              onClick={handleExportAll}
              disabled={exporting}
              sx={{
                borderRadius: "8px",
                borderColor: "rgba(47,26,122,0.25)",
                color: "#2F1A7A",
                fontWeight: 600,
                fontSize: 13,
                textTransform: "none",
                px: 1.5,
                "&:hover": { borderColor: "#2F1A7A", bgcolor: "rgba(47,26,122,0.04)" },
              }}
            >
              {exporting ? "Exporting…" : "Download"}
            </Button>
          </Box>
        </Box>

        <DataGrid
          apiRef={apiRef}
          rows={rows}
          columns={columns}
          rowCount={rowCount}
          loading={loading}
          paginationMode="server"
          sortingMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          disableColumnMenu
          rowHeight={64}
          sx={{
            border: "none",
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: "rgba(47,26,122,0.03)",
              borderBottom: "1px solid rgba(0,0,0,0.07)",
              fontSize: 12,
              fontWeight: 700,
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            },
            "& .MuiDataGrid-row": { borderBottom: "1px solid rgba(0,0,0,0.05)" },
            "& .MuiDataGrid-row:hover": { bgcolor: "rgba(47,26,122,0.025)" },
            "& .MuiDataGrid-cell": { borderBottom: "none", alignItems: "center" },
            "& .MuiDataGrid-footerContainer": { borderTop: "1px solid rgba(0,0,0,0.07)" },
          }}
        />
      </Box>
    </Box>
  );
};

export default Delegates;
