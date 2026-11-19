import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link as RouterLink, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import Dialog from '../../component/Dialog';
import { DataGrid } from '@mui/x-data-grid';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import { apiPath, apiLeadPoints, method } from '../../apiPath';
import keyNames from '../../keyName';
import { useApi, useDirect } from '../../hooks';
import { getToast } from '../../common/utils';
import { RefreshButton } from '../../component';
import { BoothChart as BoothSvgChart, RoomChart as RoomSvgChart } from './LeadCharts';
import downloadCsv from './downloadCsv';
import { fmtClock as fmtAgendaClock, fmtRange } from './agenda';

const errorToast = getToast('error');
const BRAND = '#201751';
const INK_MUTED = '#6b7280';

const RATING_CHIP = {
  hot: { label: 'Hot', color: '#dc2626', bg: '#fee2e2' },
  warm: { label: 'Warm', color: '#c2410c', bg: '#ffedd5' },
  cold: { label: 'Cold', color: '#1d4ed8', bg: '#dbeafe' },
};

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
const fmtClock = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const fmtMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

const StatTile = ({ label, value, hint }) => (
  <Paper
    elevation={0}
    sx={{ p: 2, borderRadius: '14px', border: '1px solid rgba(32,23,81,0.1)', minWidth: 0 }}
  >
    <Typography sx={{ fontSize: 11, fontWeight: 700, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 26, fontWeight: 800, color: '#111827', lineHeight: 1.2, mt: 0.5 }}>
      {value}
    </Typography>
    {hint && <Typography sx={{ fontSize: 12, color: INK_MUTED, mt: 0.25 }}>{hint}</Typography>}
  </Paper>
);

// Charts are plain SVG on the desktop (LeadCharts.js) — the source uses recharts
const RoomChart = ({ data, highlight }) => <RoomSvgChart data={data} highlight={highlight} fmt={fmtClock} />;

const BoothChart = ({ data }) => {
  // Show the day too when visits span more than one day
  const multiDay = data.length > 1 && new Date(data.at(-1).time) - new Date(data[0].time) >= 24 * 3600e3;
  return <BoothSvgChart data={data} fmt={(d) => (multiDay ? fmtDateTime(d) : fmtClock(d))} />;
};

const boothColumns = [
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
  { field: 'email', headerName: 'Email', flex: 1, minWidth: 180 },
  { field: 'mobile', headerName: 'Mobile', width: 130 },
  { field: 'organization', headerName: 'Organization', flex: 1, minWidth: 140 },
  { field: 'designation', headerName: 'Designation', minWidth: 130, flex: 0.8 },
  {
    field: 'rating',
    headerName: 'Rating',
    width: 90,
    renderCell: ({ value }) =>
      value ? (
        <Chip size="small" label={RATING_CHIP[value].label} sx={{ fontSize: 11, fontWeight: 700, color: RATING_CHIP[value].color, background: RATING_CHIP[value].bg }} />
      ) : (
        '—'
      ),
  },
  { field: 'note', headerName: 'Note', flex: 1, minWidth: 160 },
  { field: 'visitCount', headerName: 'Visits', width: 80, type: 'number' },
  {
    // Every visit, oldest first — clock times when they're all on one day, else date + time
    field: 'visitTimes',
    headerName: 'All visits',
    minWidth: 200,
    flex: 1,
    sortable: false,
    valueGetter: (v) => {
      const times = v || [];
      const oneDay = times.every((t) => new Date(t).toDateString() === new Date(times[0]).toDateString());
      return times.map((t) => (oneDay ? fmtClock(t) : fmtDateTime(t))).join(', ');
    },
    renderCell: ({ value, row }) => (
      <Tooltip
        title={
          <Box sx={{ whiteSpace: 'pre-line' }}>
            {(row.visitTimes || []).map((t, i) => `${i + 1}. ${fmtDateTime(t)}`).join('\n')}
          </Box>
        }
      >
        <span>{value || '—'}</span>
      </Tooltip>
    ),
  },
  { field: 'lastVisitAt', headerName: 'Last visit', width: 140, valueFormatter: (v) => fmtDateTime(v) },
];

const ATTEND_CHIP = {
  attended: { label: 'Attended', color: '#16a34a', bg: '#dcfce7' },
  partial: { label: 'Partial', color: '#b45309', bg: '#fef3c7' },
};

/**
 * Room columns. With a session picked, "In session" shows that session's minutes and status;
 * otherwise "Sessions" shows how many sessions each person attended.
 * `onCheckout` (null without edit permission) adds a Check out button for people still in the room.
 */
const getRoomColumns = ({ onCheckout, busy, session, sessionCount }) => [
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
  { field: 'email', headerName: 'Email', flex: 1, minWidth: 180 },
  { field: 'organization', headerName: 'Organization', flex: 1, minWidth: 140 },
  session
    ? {
        field: 'inSession',
        headerName: 'In session',
        width: 150,
        valueGetter: (_, row) => row.attendance[session._id]?.minutes ?? 0,
        renderCell: ({ row }) => {
          const a = row.attendance[session._id];
          const chip = ATTEND_CHIP[a.status];
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip size="small" label={chip.label} sx={{ fontSize: 11, fontWeight: 700, color: chip.color, background: chip.bg }} />
              {fmtMinutes(a.minutes)}
            </Box>
          );
        },
      }
    : {
        field: 'sessions',
        headerName: 'Sessions',
        width: 110,
        type: 'number',
        valueGetter: (_, row) => Object.values(row.attendance).filter((a) => a.status === 'attended').length,
        renderCell: ({ value }) => (sessionCount ? `${value} of ${sessionCount}` : '—'),
      },
  { field: 'entries', headerName: 'Entries', width: 85, type: 'number' },
  {
    field: 'minutes',
    headerName: 'Time in room',
    width: 140,
    type: 'number',
    renderCell: ({ row }) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {fmtMinutes(row.minutes)}
        {row.hasNoExitScan && (
          <Tooltip title="No exit scan on some visits — counted until the room's agenda ended that day">
            <Typography component="span" sx={{ fontSize: 12, color: INK_MUTED, cursor: 'help' }}>
              ~
            </Typography>
          </Tooltip>
        )}
      </Box>
    ),
  },
  { field: 'firstIn', headerName: 'First in', width: 140, valueFormatter: (v) => fmtDateTime(v) },
  {
    field: 'lastOut',
    headerName: 'Last out',
    width: 140,
    renderCell: ({ row }) =>
      row.isInNow ? (
        <Chip size="small" label="In room" sx={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7' }} />
      ) : row.lastOut ? (
        fmtDateTime(row.lastOut)
      ) : (
        <Typography component="span" sx={{ fontSize: 13, color: INK_MUTED }}>
          No exit scan
        </Typography>
      ),
  },
  ...(onCheckout
    ? [
        {
          field: 'actions',
          headerName: '',
          width: 120,
          sortable: false,
          renderCell: ({ row }) =>
            row.isInNow && (
              <Button
                size="small"
                color="warning"
                startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
                onClick={() => onCheckout(row)}
                disabled={busy}
              >
                Check out
              </Button>
            ),
        },
      ]
    : []),
];

/** Agenda of the room with attendance per session; clicking a session filters the table */
const AgendaAttendance = ({ agenda, selected, onSelect }) => (
  <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: '14px', border: '1px solid rgba(32,23,81,0.1)' }}>
    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Sessions</Typography>
    <Typography sx={{ fontSize: 12, color: INK_MUTED, mb: 1 }}>
      Attended = in the room for at least half the session as it actually ran. Click a session to see who was there.
    </Typography>
    {agenda.map((s, i) => {
      const active = selected === s._id;
      return (
        <Box
          key={s._id}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(active ? null : s._id)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(active ? null : s._id)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 1.5,
            py: 1.25,
            borderRadius: 1.5,
            cursor: 'pointer',
            borderTop: i && !active ? '1px solid rgba(32,23,81,0.07)' : '1px solid transparent',
            background: active ? 'rgba(32,23,81,0.07)' : 'transparent',
            '&:hover': { background: active ? 'rgba(32,23,81,0.09)' : 'rgba(32,23,81,0.03)' },
            '&:focus-visible': { outline: `2px solid ${BRAND}`, outlineOffset: -2 },
          }}
        >
          <Box sx={{ width: { xs: 104, sm: 160 }, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: BRAND }}>
              {s.actualStartTime
                ? `${fmtAgendaClock(s.actualStartTime)} – ${s.actualEndTime ? fmtAgendaClock(s.actualEndTime) : 'now'}`
                : fmtRange(s)}
            </Typography>
            <Typography sx={{ fontSize: 11, color: INK_MUTED }}>
              {s.actualStartTime ? `Scheduled ${fmtRange(s)}` : 'Not started · scheduled times'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#111827' }} noWrap>
              {s.title}
              {s.status === 'live' && (
                <Box component="span" sx={{ ml: 1, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                  ● Live
                </Box>
              )}
            </Typography>
            {s.speaker && (
              <Typography sx={{ fontSize: 12, color: INK_MUTED }} noWrap>
                {s.speaker}
              </Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#111827', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
              {s.status === 'upcoming' ? '—' : s.attended}
            </Typography>
            <Typography sx={{ fontSize: 11, color: INK_MUTED }}>
              {s.status === 'upcoming' ? 'upcoming' : s.partial ? `attended · ${s.partial} partial` : 'attended'}
            </Typography>
          </Box>
        </Box>
      );
    })}
  </Paper>
);

/**
 * Report for one booth / room: summary tiles, sessions, chart, attendee table, CSV export.
 * Ported from vosmos-events-client; built from this PC's scans and registrations.
 */
const LeadReport = () => {
  const { id } = useParams();
  const hitApi = useApi();
  const directDispatch = useDirect();
  const compact = useMediaQuery('(max-width:766.98px)');
  const canEdit = true; // no roles on the desktop
  const { leadReport, isLoading } = useSelector((s) => s.mainReducer);
  const [exporting, setExporting] = useState(false);
  const [checkout, setCheckout] = useState(null); // { all: true } | { row }
  const [checkingOut, setCheckingOut] = useState(false);
  const [sessionId, setSessionId] = useState(null); // room: session the table is filtered to

  const load = useCallback(
    () => hitApi(`${apiLeadPoints}/${id}/report`, null, method.get, keyNames.leadReport, errorToast),
    [hitApi, id]
  );

  useEffect(() => {
    directDispatch(null, keyNames.leadReport); // don't flash the previous report
    load();
  }, [load, directDispatch]);

  const report = leadReport?.point?._id === id ? leadReport : null;
  const point = report?.point;
  const isRoom = point?.type === 'room';
  const agenda = report?.agenda || [];
  const session = agenda.find((x) => x._id === sessionId) || null;
  const rows = useMemo(
    () =>
      (report?.rows || [])
        .filter((r) => !sessionId || r.attendance?.[sessionId])
        .map((r) => ({ ...r, id: r.attendeeId })),
    [report, sessionId]
  );

  const handleExport = async (view) => {
    setExporting(true);
    try {
      await downloadCsv({ type: point.type, pointId: id, view, fallbackName: `lead-capture-${point.type}${view ? `-${view}` : ''}.csv` });
    } catch (err) {
      directDispatch(getToast('error', 'Export failed', err.message).error, keyNames.toastData);
    } finally {
      setExporting(false);
    }
  };

  // Out entry at the current time — one person, or everyone still in the room
  const handleCheckout = async () => {
    const body = checkout.row ? { attendeeId: checkout.row.attendeeId } : {};
    setCheckout(null);
    setCheckingOut(true);
    try {
      const res = await axios.post(`${apiPath}${apiLeadPoints}/${id}/checkout`, body);
      directDispatch(getToast('success', 'Done', res.data.message).success, keyNames.toastData);
    } catch (err) {
      directDispatch(
        getToast('error', 'Check out failed', err.response?.data?.message || 'Try again').error,
        keyNames.toastData
      );
    } finally {
      setCheckingOut(false);
      load();
    }
  };

  const s = report?.summary;
  const tiles = !s
    ? []
    : isRoom
      ? [
          { label: 'People', value: s.attended, hint: 'scanned into the room' },
          { label: 'In room now', value: point.capacity ? `${s.inRoomNow} / ${point.capacity}` : s.inRoomNow },
          { label: 'Peak', value: s.peak.count, hint: s.peak.at ? `at ${fmtClock(s.peak.at)}` : null },
          { label: 'Avg. time', value: fmtMinutes(s.avgMinutes), hint: s.noExitScans ? `${s.noExitScans} visit${s.noExitScans === 1 ? '' : 's'} with no exit scan` : null },
        ]
      : [
          { label: 'Leads', value: s.leads },
          { label: 'Total visits', value: s.totalVisits },
          { label: 'Repeat visitors', value: s.repeatVisitors },
          { label: 'Hot / Warm / Cold', value: `${s.ratings.hot} / ${s.ratings.warm} / ${s.ratings.cold}` },
        ];

  const chartData = isRoom
    ? report?.occupancy?.map((o) => ({ t: new Date(o.time).getTime(), count: o.count }))
    : report?.byHour;
  const subtitle = isRoom
    ? [agenda.length ? `${agenda.length} ${agenda.length === 1 ? 'session' : 'sessions'}` : 'No agenda']
    : [point?.exhibitorName];

  return (
    <Box>
      <Button component={RouterLink} to="/app/lead-capture" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1 }}>
        Lead Capture
      </Button>

      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
            {point?.name || 'Report'}
          </Typography>
          <Typography sx={{ fontSize: 13, color: INK_MUTED, mt: 0.3 }}>
            {[isRoom ? 'Room attendance' : point && 'Booth leads', ...subtitle].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <RefreshButton loading={isLoading === keyNames.leadReport} tooltip="Refresh report" onClick={load} />
          {isRoom && canEdit && s?.inRoomNow > 0 && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<LogoutIcon />}
              onClick={() => setCheckout({ all: true })}
              disabled={checkingOut}
            >
              Check out all ({s.inRoomNow})
            </Button>
          )}
          {isRoom && (
            <Button variant="outlined" onClick={() => handleExport('entries')} disabled={exporting}>
              Export entries
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={() => handleExport(isRoom ? 'attendance' : undefined)}
            disabled={!point || exporting}
          >
            {exporting ? 'Exporting…' : isRoom ? 'Export attendance' : 'Export CSV'}
          </Button>
        </Box>
      </Box>

      {report && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
            {tiles.map((t) => (
              <StatTile key={t.label} {...t} />
            ))}
          </Box>

          {isRoom && agenda.length > 0 && (
            <AgendaAttendance agenda={agenda} selected={sessionId} onSelect={setSessionId} />
          )}

          <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: '14px', border: '1px solid rgba(32,23,81,0.1)' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
              {isRoom ? 'People in room over time' : 'Visits per hour'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: INK_MUTED, mb: 1.5 }}>
              {isRoom
                ? session
                  ? `Shaded: ${session.title}`
                  : 'Every 15 minutes (hourly over long spans)'
                : 'Badge scans at this booth'}
            </Typography>
            {chartData?.length ? (
              isRoom ? <RoomChart data={chartData} highlight={session} /> : <BoothChart data={chartData} />
            ) : (
              <Typography sx={{ fontSize: 13, color: '#9ca3af', py: 6, textAlign: 'center' }}>No scans yet</Typography>
            )}
          </Paper>

          {session && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: 13, color: '#374151' }}>
                Showing {rows.length} {rows.length === 1 ? 'person' : 'people'} in{' '}
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {session.title}
                </Box>
              </Typography>
              <Button size="small" onClick={() => setSessionId(null)}>
                Show everyone
              </Button>
            </Box>
          )}
          <Paper elevation={0} sx={{ borderRadius: '14px', border: '1px solid rgba(32,23,81,0.1)', overflow: 'hidden' }}>
            <DataGrid
              rows={rows}
              columns={
                isRoom
                  ? getRoomColumns({
                      onCheckout: canEdit ? (row) => setCheckout({ row }) : null,
                      busy: checkingOut,
                      session,
                      sessionCount: agenda.length,
                    })
                  : boothColumns
              }
              autoHeight
              pageSizeOptions={[25, 50, 100]}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              columnVisibilityModel={
                compact ? (isRoom ? { email: false, organization: false, firstIn: false, entries: false } : { email: false, mobile: false, designation: false, note: false }) : {}
              }
              disableColumnMenu
              disableRowSelectionOnClick
              localeText={{ noRowsLabel: isRoom ? (session ? 'No one was in this session' : 'No one has attended yet') : 'No leads yet' }}
              sx={{
                border: 'none',
                '& .MuiDataGrid-columnHeaders': {
                  background: 'rgba(32,23,81,0.03)',
                  '& .MuiDataGrid-columnHeaderTitle': {
                    fontSize: 11,
                    fontWeight: 700,
                    color: INK_MUTED,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  },
                },
                '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center', outline: 'none !important' },
              }}
            />
          </Paper>
        </>
      )}

      <Dialog open={Boolean(checkout)} onClose={() => setCheckout(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>
          {checkout?.row ? `Check out ${checkout.row.name}?` : 'Check out everyone in the room?'}
        </DialogTitle>
        <DialogContent sx={{ fontSize: 14, color: '#374151' }}>
          {checkout?.row
            ? 'They get an out entry at the current time.'
            : `${s?.inRoomNow} ${s?.inRoomNow === 1 ? 'person gets' : 'people get'} an out entry at the current time.`}{' '}
          Anyone scanned again afterwards is checked back in.
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCheckout(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleCheckout}>
            {checkout?.row ? 'Check out' : 'Check out all'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LeadReport;
