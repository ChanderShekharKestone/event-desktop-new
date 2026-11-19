import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import BarcodeReader from 'react-barcode-reader';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { apiPath } from '../../apiPath';
import { useQrScanner, useScanInput } from '../../hooks';
import { screenBackground, SCREEN_ALIGN } from '../../common/utils';
import ScanResult from './ScanResult';
import BoothLeadForm from './BoothLeadForm';
import SessionList from './SessionList';
import { fmtClock, fmtRange, runningSession } from '../lead-capture/agenda';

const RESTART_DELAY_MS = 1500; // camera restarts by itself so volunteers can scan the next badge
const SAME_BADGE_MS = 3000; // ignore the same badge read twice in a row by the camera
const LIVE_REFRESH_MS = 30000; // session rooms: pick up scans from other devices at the same room

const MODES = {
  smart: { label: 'Smart In/Out', color: '#2563eb' },
  entry: { label: 'Entry', color: '#16a34a' },
  exit: { label: 'Exit', color: '#ea580c' },
};
const MODE_HINTS = {
  smart: 'Scan to mark IN — scan again to mark OUT (you confirm first)',
  entry: 'Entry door — scans only mark people IN',
  exit: 'Exit door — scans only mark people OUT',
};

const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const GONE = /link|no longer exists/i; // 404s that mean this scanner can't be used any more

/**
 * Ported from vosmos-events-client (pages/lead-scanner). Opened on phones / tablets on the
 * LAN from a link made in Lead Capture; the raw QR text goes to this PC's server, which reads
 * every badge format (uniqueUserId, cloud _id, older JSON badges, desktop walk-ins).
 *
 * Public lead capture scanner screen for one booth / room. `base` is its public API path —
 * a booth / room link (public/lead/:token) or the universal link's pick
 * (public/lead-event/:token/points/:id). `onChangePoint` (universal link only) lets the
 * volunteer go back and pick another booth or room.
 * Booth: each scan records a visit, then staff can rate the lead.
 * Room: "Smart In/Out" by default — a scan marks them IN, a scan while they're in asks to mark
 * them OUT, and a scan while they're in another room asks to move them. Entry / Exit are for
 * separate doors.
 * The volunteer starts each session by hand (events run late) — that is shared by every
 * scanner in the room, and attendance is worked out from room time against those real times.
 */
const ScannerScreen = ({ base, onChangePoint }) => {
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [state, setState] = useState({ status: 'loading', info: null, message: '' });
  const [mode, setMode] = useState('smart');
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState(null); // { id, data } | { id, error }
  // Server asked the volunteer first: { id, data } with data.result "confirm-out" | "confirm-move"
  const [pending, setPending] = useState(null);

  // The camera callback is created once per start, so it reads current values through refs
  const live = useRef({});
  live.current.mode = mode;
  live.current.cameraOn = cameraOn;
  live.current.busy = busy || Boolean(pending); // no new scans while a popup is open
  const lastBadge = useRef({ id: null, at: 0 });
  const scanCount = useRef(0);

  const loadInfo = useCallback(
    () =>
      axios
        .get(apiPath + base)
        .then((res) => setState({ status: 'ready', info: res.data.data, message: '' }))
        .catch((err) => {
          // A 5xx / network blip shouldn't kick a working scanner off its screen
          if ((err.response?.status === 404 && GONE.test(err.response?.data?.message || '')) || !live.current.loaded) {
            setState({
              status: 'invalid',
              info: null,
              message: err.response?.data?.message || 'Could not open this scanner link.',
            });
          }
        }),
    [base]
  );

  useEffect(() => {
    loadInfo().then(() => (live.current.loaded = true));
  }, [loadInfo]);

  const isRoom = state.info?.type === 'room';
  useEffect(() => {
    if (!isRoom) return;
    const timer = setInterval(loadInfo, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isRoom, loadInfo]);

  // `confirm` ("out" | "move") resends a scan the volunteer just confirmed in a popup
  const submit = async (id, confirm) => {
    if (live.current.busy && !confirm) return;
    const now = Date.now();
    if (!confirm && id && lastBadge.current.id === id && now - lastBadge.current.at < SAME_BADGE_MS) return;
    lastBadge.current = { id, at: now };

    const scanId = ++scanCount.current;
    if (!id) {
      setLastScan({ id: scanId, error: 'Not a valid badge QR code' });
      return;
    }

    setBusy(true);
    try {
      const res = await axios.post(apiPath + base + '/scan', {
        id,
        mode: live.current.mode,
        ...(confirm && { confirm }),
      });
      const data = res.data.data;
      if (data.result === 'confirm-out' || data.result === 'confirm-move') {
        setPending({ id, data });
        navigator.vibrate?.([40, 40]);
        return;
      }
      setLastScan({ id: scanId, data });
      navigator.vibrate?.(80);
      if (data.liveCount !== undefined)
        setState((s) => ({ ...s, info: { ...s.info, liveCount: data.liveCount } }));
    } catch (err) {
      if (err.response?.status === 404 && GONE.test(err.response?.data?.message || '')) {
        setState({ status: 'invalid', info: null, message: err.response.data.message });
        return;
      }
      setLastScan({ id: scanId, error: err.response?.data?.message || 'Scan failed. Try again.' });
      navigator.vibrate?.([60, 60, 60]);
    } finally {
      setBusy(false);
    }
  };

  const answerPending = (confirmed) => {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (confirmed) submit(p.id, p.data.result === 'confirm-out' ? 'out' : 'move');
    else setLastScan({ id: ++scanCount.current, data: { result: 'cancelled', attendee: p.data.attendee } });
  };

  const onRawScan = (_source, text) => submit(typeof text === 'string' ? text.trim() : '');
  useScanInput((text) => onRawScan('handheld input', text));

  const { startScanning, isScanning, resetScanner } = useQrScanner({
    onScan: async (text) => {
      await onRawScan('camera', text);
      // The scanner stops after each read — start it again for the next badge
      setTimeout(() => live.current.cameraOn && live.current.start?.(), RESTART_DELAY_MS);
    },
  });
  live.current.start = startScanning;

  const toggleCamera = () => {
    if (cameraOn) {
      setCameraOn(false);
      resetScanner();
    } else {
      setCameraOn(true);
      startScanning();
    }
  };

  if (state.status === 'loading') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state.status === 'invalid') {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          background: '#f4f6f8',
        }}
      >
        <Paper sx={{ maxWidth: 420, p: 5, borderRadius: 3, textAlign: 'center' }}>
          <LinkOffIcon sx={{ fontSize: 48, color: '#dc2626', mb: 1 }} />
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
            Scanner link not available
          </Typography>
          <Typography color="text.secondary">{state.message}</Typography>
          {onChangePoint && (
            <Button variant="contained" sx={{ mt: 3 }} onClick={onChangePoint}>
              Choose a booth or room
            </Button>
          )}
        </Paper>
      </Box>
    );
  }

  const { info } = state;
  const modeColor = isRoom ? MODES[mode].color : 'primary.main';

  // Room: the session a volunteer started on any scanner in this room
  const agenda = info.agenda || [];
  const running = runningSession(agenda);
  const handleSessionsDone = (updated) => {
    setSessionsOpen(false);
    setState((st) => ({ ...st, info: { ...st.info, agenda: updated } }));
  };

  // Background, title, description and position come from the admin's scanner screen settings
  const screen = info.screen || {};
  const background = screenBackground(screen.backgroundUrl);
  const description = screen.description || (isRoom ? running?.title || '' : info.exhibitorName || '');
  const cardSx = { maxWidth: 480, width: '100%', borderRadius: 3 };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        p: { xs: 1.5, sm: 3 },
        // Extra side room on wide screens so left / right cards don't touch the edge
        px: { md: 6 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: { xs: 'center', md: SCREEN_ALIGN[screen.position] || 'center' },
        gap: 2,
        background: background || '#f4f6f8',
      }}
    >
      <BarcodeReader
        onScan={(data) => onRawScan('handheld', data)}
        onError={(err) => console.error(err)}
      />

      <Paper sx={{ ...cardSx, px: { xs: 2.5, sm: 4 }, py: 2.5, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {isRoom ? 'Room attendance' : 'Booth lead capture'}
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.3, mt: 0.25 }}>
          {screen.title || info.name}
        </Typography>
        {description && (
          <Typography sx={{ fontSize: 14, color: '#6b7280', mt: 0.5, whiteSpace: 'pre-line' }}>
            {description}
          </Typography>
        )}
        {onChangePoint && (
          <Button size="small" onClick={onChangePoint} sx={{ mt: 1 }}>
            Change booth / room
          </Button>
        )}
      </Paper>

      <Paper sx={{ ...cardSx, p: { xs: 2.5, sm: 4 } }}>
        {isRoom && (
          <>
            {agenda.length > 0 && (
              <Box
                sx={{
                  mb: 2,
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: running ? '#bbf7d0' : '#fde68a',
                  background: running ? '#f0fdf4' : '#fffbeb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: running ? '#16a34a' : '#b45309', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {running ? 'Session now' : 'No session started'}
                  </Typography>
                  {running ? (
                    <>
                      <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#111827' }} noWrap>
                        {running.title}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: '#6b7280' }} noWrap>
                        Started {fmtClock(running.actualStartTime)} · scheduled {fmtRange(running)}
                      </Typography>
                    </>
                  ) : (
                    <Typography sx={{ fontSize: 13, color: '#374151' }}>
                      Start the session when it actually begins
                    </Typography>
                  )}
                </Box>
                <Button
                  variant={running ? 'outlined' : 'contained'}
                  size="small"
                  onClick={() => setSessionsOpen(true)}
                  sx={{ flexShrink: 0 }}
                >
                  {running ? 'Change' : 'Start session'}
                </Button>
              </Box>
            )}
            <Dialog open={sessionsOpen} onClose={() => setSessionsOpen(false)} maxWidth="xs" fullWidth>
              <DialogTitle sx={{ fontSize: 17, fontWeight: 700, pb: 0.5 }}>Which session is on now?</DialogTitle>
              <DialogContent>
                <Typography sx={{ fontSize: 13, color: '#6b7280', mb: 1.5 }}>
                  Choose it when it actually starts — the running session ends at that moment.
                </Typography>
                <SessionList base={base} agenda={agenda} onDone={handleSessionsDone} />
              </DialogContent>
            </Dialog>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: '#f8fafc',
                border: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                gap: 1,
              }}
            >
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: '#111827' }}>
                {info.liveCount ?? 0}
              </Typography>
              <Typography sx={{ fontSize: 14, color: '#6b7280' }}>
                {info.capacity ? `/ ${info.capacity} in room now` : 'in room now'}
              </Typography>
            </Box>

            <ToggleButtonGroup
              exclusive
              fullWidth
              value={mode}
              onChange={(_, v) => v && setMode(v)}
              sx={{ mt: 2 }}
            >
              {Object.entries(MODES).map(([value, m]) => (
                <ToggleButton
                  key={value}
                  value={value}
                  sx={{
                    py: 1.25,
                    fontWeight: 700,
                    fontSize: 14,
                    '&.Mui-selected, &.Mui-selected:hover': { bgcolor: m.color, color: '#fff' },
                  }}
                >
                  {m.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography sx={{ fontSize: 13, color: MODES[mode].color, mt: 1, textAlign: 'center' }}>
              {MODE_HINTS[mode]}
            </Typography>
          </>
        )}

        <Box
          sx={{
            mt: 2,
            position: 'relative',
            border: '3px dashed',
            borderColor: cameraOn ? modeColor : '#ccc',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* html5-qrcode owns this element's children — React must never render inside it */}
          <Box
            id="qr-reader"
            className={isScanning ? 'scanner-line' : undefined}
            sx={{ minHeight: 220, position: 'relative' }}
          />
          {!isScanning && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Typography sx={{ color: '#9ca3af', fontSize: 14, px: 2, textAlign: 'center' }}>
                {cameraOn ? 'Getting ready for the next badge…' : 'Start the camera, or use a handheld scanner'}
              </Typography>
            </Box>
          )}
        </Box>

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={toggleCamera}
          sx={{ mt: 2, py: 1.25, ...(cameraOn ? {} : { bgcolor: modeColor, '&:hover': { bgcolor: modeColor } }) }}
          color={cameraOn ? 'inherit' : 'primary'}
        >
          {cameraOn ? 'Stop camera' : 'Start camera'}
        </Button>

        <Box sx={{ mt: 2, minHeight: 72 }}>
          {busy ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <ScanResult scan={lastScan} />
          )}
        </Box>

        {!isRoom && lastScan?.data && (
          <BoothLeadForm
            key={lastScan.id}
            base={base}
            attendeeId={lastScan.data.attendee._id}
            initialRating={lastScan.data.rating}
            initialNote={lastScan.data.note}
          />
        )}
      </Paper>

      {/* Smart mode OUT, or a move from another room — saved only when the volunteer confirms */}
      <Dialog open={Boolean(pending)} onClose={() => answerPending(false)} maxWidth="xs" fullWidth>
        {pending && (
          <>
            <DialogTitle sx={{ fontSize: 18, fontWeight: 700, pb: 0.5 }}>{pending.data.attendee?.name}</DialogTitle>
            <DialogContent sx={{ fontSize: 16, color: '#374151' }}>
              {pending.data.result === 'confirm-out' ? (
                <>
                  IN this room since <b>{fmtTime(pending.data.since)}</b>. Mark OUT now?
                </>
              ) : (
                <>
                  Still IN <b>{pending.data.fromRoom}</b> since <b>{fmtTime(pending.data.since)}</b>. Exit{' '}
                  {pending.data.fromRoom} and enter this room?
                </>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button size="large" onClick={() => answerPending(false)}>
                Cancel
              </Button>
              <Button
                size="large"
                variant="contained"
                color={pending.data.result === 'confirm-out' ? 'warning' : 'success'}
                onClick={() => answerPending(true)}
                autoFocus
              >
                {pending.data.result === 'confirm-out' ? 'Mark OUT' : 'Yes, move here'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ScannerScreen;
