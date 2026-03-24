import { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Chip,
  TextField,
  Button,
  InputAdornment,
  CircularProgress,
  Tooltip,
  IconButton,
} from "@mui/material";
import { Search, FileDownload, Done, Print } from "@mui/icons-material";
import { DataGrid, useGridApiRef } from "@mui/x-data-grid";
import axios from "axios";
import { useSelector } from "react-redux";
import useDebounce from "../../hooks/useDebounce";
import { apiPath, apiGetRegistrations, apiUserScan } from "../../apiPath";
import PrintableBadgeModal from "./PrintableBadgeModal";

const actionBtnSx = {
  width: 34,
  height: 34,
  borderRadius: "8px",
  bgcolor: "rgba(124,58,237,0.1)",
  color: "#7C3AED",
  "&:hover": { bgcolor: "rgba(124,58,237,0.2)" },
  "&.Mui-disabled": {
    bgcolor: "rgba(124,58,237,0.05)",
    color: "rgba(124,58,237,0.3)",
  },
};

const Delegates = () => {
  const apiRef = useGridApiRef();
  const { badgeTemplatesData } = useSelector((s) => s.mainReducer);

  const [rows, setRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });
  const [sortModel, setSortModel] = useState([
    { field: "createdAt", sort: "desc" },
  ]);
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
        params: {
          page: page + 1,
          limit: pageSize,
          search: debouncedSearch,
          sort,
          order,
        },
      });
      setRows((data.data || []).map((r, i) => ({ ...r, id: r._id ?? i })));
      setRowCount(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch delegates:", err.message);
    } finally {
      setLoading(false);
    }
  }, [paginationModel, sortModel, debouncedSearch]);

  useEffect(() => {
    fetchDelegates();
  }, [fetchDelegates]);
  useEffect(() => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [debouncedSearch]);

  const markAttendance = useCallback(
    async (row) => {
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
    },
    [fetchDelegates],
  );

  const handleExportAll = useCallback(async () => {
    setExporting(true);
    try {
      const sort = sortModel[0]?.field || "createdAt";
      const order = sortModel[0]?.sort || "desc";
      const { data } = await axios.get(`${apiPath}${apiGetRegistrations}`, {
        params: {
          page: 1,
          limit: rowCount || 100000,
          search: debouncedSearch,
          sort,
          order,
        },
      });
      const all = data.data || [];
      const headers = [
        "First Name",
        "Last Name",
        "Email",
        "Mobile",
        "Organization",
        "Designation",
        "Checked In",
        "Payment Status",
        "Registered At",
      ];
      const csvRows = [
        headers.join(","),
        ...all.map((r) =>
          [
            r.firstName,
            r.lastName,
            r.email,
            r.mobile,
            r.organization,
            r.designation,
            r.isCheckedIn ? "Yes" : "No",
            r.paymentStatus,
            r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
          ]
            .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      ];
      const blob = new Blob([csvRows.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
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
    { field: "firstName", headerName: "First Name", width: 130 },
    { field: "lastName", headerName: "Last Name", width: 130 },
    { field: "email", headerName: "Email", width: 220 },
    { field: "mobile", headerName: "Mobile", width: 130 },
    { field: "organization", headerName: "Organization", width: 160 },
    { field: "designation", headerName: "Designation", width: 150 },
    {
      field: "isCheckedIn",
      headerName: "Checked In",
      width: 120,
      renderCell: ({ value }) => (
        <Chip
          label={value ? "Yes" : "No"}
          size="small"
          sx={{
            bgcolor: value ? "rgba(22,163,74,0.1)" : "rgba(156,163,175,0.15)",
            color: value ? "#16A34A" : "#6B7280",
            fontWeight: 600,
            fontSize: "0.75rem",
          }}
        />
      ),
    },
    { field: "paymentStatus", headerName: "Payment", width: 120 },
    {
      field: "createdAt",
      headerName: "Registered At",
      width: 180,
      valueFormatter: (value) =>
        value ? new Date(value).toLocaleString() : "",
    },
    {
      field: "action",
      headerName: "Action",
      width: 100,
      sortable: false,
      renderCell: ({ row }) => (
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip
            title={row.isCheckedIn ? "Already Checked In" : "Mark Attendance"}
          >
            <span>
              <IconButton
                sx={actionBtnSx}
                onClick={() => markAttendance(row)}
                disabled={row.isCheckedIn}
              >
                <Done sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip
            title={
              badgeTemplatesData?.length
                ? "Print Badge"
                : "No badge templates — pull in Settings"
            }
          >
            <span>
              <IconButton
                sx={actionBtnSx}
                onClick={() => setOpenBadge(row)}
                disabled={!badgeTemplatesData?.length}
              >
                <Print sx={{ fontSize: 18 }} />
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
          onClose={() => {
            setOpenBadge(null);
            fetchDelegates();
          }}
          badgeData={badgeTemplatesData}
        />
      )}

      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Typography variant="h5" fontWeight={700} sx={{ color: "#1E1033" }}>
          Delegates
          <Typography
            component="span"
            variant="body2"
            sx={{ ml: 1.5, color: "#6B7280", fontWeight: 400 }}
          >
            {rowCount.toLocaleString()} records
          </Typography>
        </Typography>

        <Box display="flex" gap={1.5} alignItems="center">
          <TextField
            size="small"
            placeholder="Search name, email, org…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 18, color: "#9CA3AF" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: 260,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                "& fieldset": { borderColor: "rgba(124,58,237,0.2)" },
                "&:hover fieldset": { borderColor: "rgba(124,58,237,0.4)" },
                "&.Mui-focused fieldset": { borderColor: "#7C3AED" },
              },
            }}
          />

          <Button
            variant="outlined"
            startIcon={
              exporting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <FileDownload />
              )
            }
            onClick={handleExportAll}
            disabled={exporting}
            sx={{
              borderRadius: "10px",
              borderColor: "rgba(124,58,237,0.3)",
              color: "#7C3AED",
              fontWeight: 600,
              textTransform: "none",
              "&:hover": {
                borderColor: "#7C3AED",
                bgcolor: "rgba(124,58,237,0.06)",
              },
            }}
          >
            {exporting ? "Exporting…" : "Export CSV"}
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
        pageSizeOptions={[10, 25, 50, 100]}
        disableRowSelectionOnClick
        autoHeight
        sx={{
          borderRadius: "12px",
          border: "1px solid rgba(124,58,237,0.12)",
          bgcolor: "#fff",
          "& .MuiDataGrid-columnHeaders": {
            bgcolor: "rgba(124,58,237,0.04)",
            borderBottom: "1px solid rgba(124,58,237,0.12)",
            fontWeight: 700,
            color: "#1E1033",
          },
          "& .MuiDataGrid-row:hover": { bgcolor: "rgba(124,58,237,0.03)" },
          "& .MuiDataGrid-loadingOverlay": { bgcolor: "rgba(255,255,255,0.7)" },
        }}
      />
    </Box>
  );
};

export default Delegates;
