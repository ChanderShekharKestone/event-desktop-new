import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  InputAdornment,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { apiPath, apiPublicLeadEvent } from '../../apiPath';
import { agendaStatus } from '../lead-capture/agenda';
import ScannerScreen from './ScannerScreen';
import SessionList from './SessionList';

// The booth / room picked on this device is remembered per link, so a refresh goes straight back
const pickKey = (token) => `lead-scan:${token}`;
const readStore = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeStore = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage — the choice just isn't remembered
  }
};

const pageSx = { minHeight: '100vh', background: '#f4f6f8', p: { xs: 1.5, sm: 3 }, display: 'flex', justifyContent: 'center' };
const cardSx = { maxWidth: 520, width: '100%', borderRadius: 3, p: { xs: 2.5, sm: 3.5 }, alignSelf: 'flex-start' };

const Choice = ({ title, sub, extra, onClick }) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      width: '100%',
      textAlign: 'left',
      justifyContent: 'flex-start',
      gap: 1.5,
      px: 2,
      py: 1.5,
      borderRadius: 2,
      border: '1px solid #e5e7eb',
      background: '#fff',
      '&:hover': { borderColor: '#201751', background: 'rgba(32,23,81,0.03)' },
    }}
  >
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#111827' }} noWrap>
        {title}
      </Typography>
      {sub && (
        <Typography sx={{ fontSize: 13, color: '#6b7280' }} noWrap>
          {sub}
        </Typography>
      )}
    </Box>
    {extra}
    <ChevronRightIcon sx={{ color: '#9ca3af' }} />
  </ButtonBase>
);

/**
 * Universal lead capture scanner (#/lead-scan/:token on this PC's LAN address), no login. The volunteer picks a booth,
 * or a room and its session, then scans exactly as on a booth / room's own link.
 */
const EventScanner = () => {
  const { token } = useParams();
  const [state, setState] = useState({ status: 'loading', info: null, message: '' });
  const [kind, setKind] = useState('booth');
  const [query, setQuery] = useState('');
  const [roomForSession, setRoomForSession] = useState(null); // room picked, choosing its session
  const [pointId, setPointId] = useState(() => readStore(pickKey(token)));

  const load = useCallback(
    () =>
      axios
        .get(apiPath + apiPublicLeadEvent(token))
        .then((res) => {
          const info = res.data.data;
          setState({ status: 'ready', info, message: '' });
          if (!info.booths.length && info.rooms.length) setKind('room');
        })
        .catch((err) =>
          setState({
            status: 'invalid',
            info: null,
            message: err.response?.data?.message || 'Could not open this scanner link.',
          })
        ),
    [token]
  );

  // Only needed while choosing — the scanner screen loads its own booth / room
  useEffect(() => {
    if (!pointId) load();
  }, [pointId, load]);

  const choose = (id) => {
    writeStore(pickKey(token), id);
    setPointId(id);
    setRoomForSession(null);
  };

  const changePoint = () => {
    writeStore(pickKey(token), null);
    setPointId(null);
    setState((s) => ({ ...s, status: 'loading' }));
  };

  if (pointId) {
    return (
      <ScannerScreen
        key={pointId}
        base={`${apiPublicLeadEvent(token)}/points/${pointId}`}
        onChangePoint={changePoint}
      />
    );
  }

  if (state.status === 'loading') {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state.status === 'invalid') {
    return (
      <Box sx={{ ...pageSx, alignItems: 'center' }}>
        <Paper sx={{ maxWidth: 420, p: 5, borderRadius: 3, textAlign: 'center' }}>
          <LinkOffIcon sx={{ fontSize: 48, color: '#dc2626', mb: 1 }} />
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
            Scanner link not available
          </Typography>
          <Typography color="text.secondary">{state.message}</Typography>
        </Paper>
      </Box>
    );
  }

  const { info } = state;

  // Step 2 for rooms: confirm or start the session that is on now
  if (roomForSession) {
    const room = roomForSession;
    const status = agendaStatus(room.agenda);
    return (
      <Box sx={pageSx}>
        <Paper sx={cardSx}>
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => setRoomForSession(null)} sx={{ mb: 1, ml: -1 }}>
            Rooms
          </Button>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{room.name}</Typography>
          <Typography sx={{ fontSize: 14, color: '#6b7280', mb: 2 }}>
            Which session is on now? Starting one ends the session running before it.
          </Typography>
          <SessionList
            base={`${apiPublicLeadEvent(token)}/points/${room._id}`}
            agenda={room.agenda}
            onDone={() => choose(room._id)}
          />
          <Button fullWidth sx={{ mt: 2 }} onClick={() => choose(room._id)}>
            {status?.label === 'Now' ? `Keep "${status.session.title}" and scan` : 'Scan without starting a session'}
          </Button>
        </Paper>
      </Box>
    );
  }

  // Step 1: booth or room, by name
  const q = query.trim().toLowerCase();
  const list = (kind === 'booth' ? info.booths : info.rooms).filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.exhibitorName?.toLowerCase().includes(q)
  );

  return (
    <Box sx={pageSx}>
      <Paper sx={cardSx}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Lead capture scanner
        </Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
          {info.eventName || 'Choose where you are scanning'}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#6b7280', mt: 0.25, mb: 2 }}>
          Where are you scanning badges?
        </Typography>

        <ToggleButtonGroup exclusive fullWidth value={kind} onChange={(_, v) => v && setKind(v)} sx={{ mb: 1.5 }}>
          <ToggleButton value="booth" sx={{ fontWeight: 700 }}>
            Booth ({info.booths.length})
          </ToggleButton>
          <ToggleButton value="room" sx={{ fontWeight: 700 }}>
            Room ({info.rooms.length})
          </ToggleButton>
        </ToggleButtonGroup>

        <TextField
          fullWidth
          size="small"
          placeholder={kind === 'booth' ? 'Search booth or exhibitor' : 'Search room'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ mb: 1.5 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {list.length === 0 ? (
            <Typography sx={{ fontSize: 14, color: '#6b7280', textAlign: 'center', py: 4 }}>
              {q ? 'No match' : kind === 'booth' ? 'No booths set up yet' : 'No rooms set up yet'}
            </Typography>
          ) : kind === 'booth' ? (
            list.map((b) => <Choice key={b._id} title={b.name} sub={b.exhibitorName} onClick={() => choose(b._id)} />)
          ) : (
            list.map((r) => {
              const status = agendaStatus(r.agenda);
              return (
                <Choice
                  key={r._id}
                  title={r.name}
                  sub={status ? `${status.label}: ${status.text}` : `${r.agenda.length} sessions`}
                  extra={
                    <Typography sx={{ fontSize: 13, color: '#6b7280', flexShrink: 0 }}>
                      {r.liveCount} in
                    </Typography>
                  }
                  // No agenda → nothing to choose, go straight to scanning
                  onClick={() => (r.agenda.length ? setRoomForSession(r) : choose(r._id))}
                />
              );
            })
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default EventScanner;
