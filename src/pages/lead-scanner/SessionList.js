import { useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import Dialog from '../../component/Dialog';
import { apiPath } from '../../apiPath';
import { groupByDay, runningSession, sessionState } from '../lead-capture/agenda';

const STATE_STYLE = {
  running: { label: 'Running', color: '#16a34a', bg: '#dcfce7' },
  ended: { label: 'Ended', color: '#64748b', bg: '#f1f5f9' },
  'not-started': { label: 'Not started', color: '#201751', bg: 'rgba(32,23,81,0.07)' },
};

/**
 * A room's sessions for the volunteer to choose from. Choosing one that isn't running asks
 * first, then starts it on the server (POST `${base}/session`) — which also ends whatever was
 * running. `onDone(agenda)` gets the updated agenda (or the same one when nothing changed).
 */
const SessionList = ({ base, agenda, onDone }) => {
  const [confirm, setConfirm] = useState(null); // session to start
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const running = runningSession(agenda);

  const pick = (s) => {
    if (running?._id === s._id) onDone(agenda);
    else setConfirm(s);
  };

  const start = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await axios.post(`${apiPath}${base}/session`, { sessionId: confirm._id });
      setConfirm(null);
      onDone(res.data.data.agenda);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start the session. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {groupByDay(agenda).map((g) => (
          <Box key={g.day} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, mt: 0.5 }}>
              {g.day}
            </Typography>
            {g.sessions.map((s) => {
              const state = sessionState(s);
              const style = STATE_STYLE[state.key];
              return (
                <ButtonBase
                  key={s._id}
                  onClick={() => pick(s)}
                  sx={{
                    width: '100%',
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    px: 2,
                    py: 1.25,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: state.key === 'running' ? '#16a34a' : '#e5e7eb',
                    background: '#fff',
                    '&:hover': { borderColor: '#201751' },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#111827' }} noWrap>
                      {s.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#6b7280' }} noWrap>
                      {[state.text, s.speaker].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <Box
                    component="span"
                    sx={{ ml: 1, px: 1, py: 0.25, borderRadius: 1, fontSize: 11, fontWeight: 700, color: style.color, background: style.bg, flexShrink: 0 }}
                  >
                    {style.label}
                  </Box>
                </ButtonBase>
              );
            })}
          </Box>
        ))}
      </Box>

      <Dialog open={Boolean(confirm)} onClose={saving ? undefined : () => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
          {confirm?.actualEndTime ? `Restart "${confirm?.title}"?` : `Start "${confirm?.title}" now?`}
        </DialogTitle>
        <DialogContent sx={{ fontSize: 15, color: '#374151' }}>
          {confirm?.actualEndTime && <p style={{ marginTop: 0 }}>It already ran ({sessionState(confirm).text.replace('Ran ', '')}).</p>}
          {running ? (
            <>
              "{running.title}" will end now. Every scanner in this room switches to the new session.
            </>
          ) : (
            'Every scanner in this room switches to this session.'
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(null)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={start} disabled={saving}>
            {saving ? 'Starting…' : confirm?.actualEndTime ? 'Restart' : 'Start now'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SessionList;
