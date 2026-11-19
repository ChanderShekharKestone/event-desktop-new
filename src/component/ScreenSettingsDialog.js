import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import { apiPath } from '../apiPath';
import keyNames from '../keyName';
import { useDirect } from '../hooks';
import { getToast, SCREEN_ALIGN } from '../common/utils';

const EMPTY = { backgroundUrl: '', title: '', description: '', position: 'center' };
const POSITIONS = [
  { value: 'left', label: 'Left', Icon: FormatAlignLeftIcon },
  { value: 'center', label: 'Center', Icon: FormatAlignCenterIcon },
  { value: 'right', label: 'Right', Icon: FormatAlignRightIcon },
];
const LIMITS = { title: 120, description: 300 };

const isHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/**
 * Ported from vosmos-events-client (component/ScreenSettingsDialog.js).
 * Public scanner screen look (kiosk, booth, session room) — background image (CDN URL),
 * title, description and card position. Loads from and saves to `path` (GET / PUT).
 * Empty fields fall back to `defaults` ({ title, description }) on the screen.
 */
const ScreenSettingsDialog = ({ open, onClose, path, heading = 'Screen settings', defaults = {} }) => {
  const directDispatch = useDirect();
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState('loading'); // loading | ready | saving | error
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus('loading');
    axios
      .get(apiPath + path)
      .then((res) => {
        setForm({ ...EMPTY, ...res.data.data });
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [open, path]);

  const url = form.backgroundUrl.trim();
  const urlError = url && !isHttpUrl(url) ? 'Enter a full URL starting with https://' : '';
  const busy = status === 'loading' || status === 'saving';

  const setField = (key) => (e) => {
    if (key === 'backgroundUrl') setImageFailed(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      const res = await axios.put(apiPath + path, form);
      directDispatch(getToast('success', 'Saved', res.data.message).success, keyNames.toastData);
      onClose();
    } catch (err) {
      directDispatch(
        getToast('error', 'Save failed', err.response?.data?.message || 'Try again').error,
        keyNames.toastData
      );
      setStatus('ready');
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{heading}</DialogTitle>
      <DialogContent>
        {status === 'loading' ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : status === 'error' ? (
          <Alert severity="error">Could not load the screen settings. Close and try again.</Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Background image URL"
              placeholder="https://cdn.example.com/background.jpg"
              value={form.backgroundUrl}
              onChange={setField('backgroundUrl')}
              error={Boolean(urlError)}
              helperText={urlError || 'CDN image link. Landscape, about 1920 × 1080, works best.'}
              fullWidth
            />

            {/* Preview — the kiosk dims the image so the text and scan card stay readable */}
            <Box
              sx={{
                position: 'relative',
                height: 180,
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid rgba(32,23,81,0.1)',
                background: '#f4f6f8',
                display: 'flex',
                flexDirection: 'column',
                alignItems: SCREEN_ALIGN[form.position],
                justifyContent: 'center',
                textAlign: 'center',
                px: 2,
              }}
            >
              {url && !urlError && !imageFailed && (
                <>
                  <Box
                    component="img"
                    src={url}
                    alt=""
                    onError={() => setImageFailed(true)}
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <Box sx={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
                </>
              )}
              {/* Same card the kiosk shows above the scan card */}
              <Box
                sx={{
                  position: 'relative',
                  width: '55%',
                  maxWidth: 260,
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                  {form.title.trim() || defaults.title || 'Title'}
                </Typography>
                <Typography sx={{ fontSize: 11, color: '#6b7280', mt: 0.5, whiteSpace: 'pre-line' }}>
                  {form.description.trim() || defaults.description}
                </Typography>
              </Box>
            </Box>
            {imageFailed && (
              <Alert severity="warning">
                This image could not be loaded. Check the URL is public and points to an image.
              </Alert>
            )}

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#374151', mb: 0.75 }}>
                Card position
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={form.position}
                onChange={(_, v) => v && setForm((f) => ({ ...f, position: v }))}
              >
                {POSITIONS.map(({ value, label, Icon }) => (
                  <ToggleButton key={value} value={value} sx={{ textTransform: 'none', gap: 0.75, px: 2 }}>
                    <Icon fontSize="small" />
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography sx={{ fontSize: 12, color: '#6b7280', mt: 0.5 }}>
                On phones the cards are always centred.
              </Typography>
            </Box>

            <TextField
              label="Title"
              placeholder={defaults.title ? `Default: ${defaults.title}` : undefined}
              value={form.title}
              onChange={setField('title')}
              inputProps={{ maxLength: LIMITS.title }}
              helperText={`${form.title.length}/${LIMITS.title}`}
              fullWidth
            />
            <TextField
              label="Description"
              placeholder={defaults.description || undefined}
              value={form.description}
              onChange={setField('description')}
              inputProps={{ maxLength: LIMITS.description }}
              helperText={`${form.description.length}/${LIMITS.description}`}
              multiline
              minRows={2}
              fullWidth
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={status === 'saving'}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={status !== 'ready' || Boolean(urlError)}
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScreenSettingsDialog;
