import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { apiLeadLink, apiLeadPoints, apiLeadScreen, method } from '../../apiPath';
import keyNames from '../../keyName';
import { useApi, useDirect } from '../../hooks';
import useLanBase from '../../hooks/useLanBase';
import { getToast } from '../../common/utils';
import { RefreshButton, ScreenSettingsDialog } from '../../component';
import PointCard from './PointCard';
import PointDialog from './PointDialog';
import AgendaDialog from './AgendaDialog';
import EventLinkBar from './EventLinkBar';
import downloadCsv from './downloadCsv';
import LinkQrDialog from './LinkQrDialog';

const errorToast = getToast('error');
const withToast = () => ({ ...getToast('success', null, keyNames.apiMsg), ...getToast('error') });
const LIVE_REFRESH_MS = 30000; // room counts change while people are being scanned

const TABS = {
  booth: { label: 'Booths', add: 'Add booth', empty: 'No booths yet' },
  room: { label: 'Rooms', add: 'Add room', empty: 'No rooms yet' },
};

/**
 * Lead Capture — booths and rooms (with their session agenda). Ported from
 * vosmos-events-client; everything is stored on this PC and works offline. Volunteers scan
 * on phones / tablets on the same network through the universal link (#/lead-scan/:token) or
 * a booth / room's own link (#/lead/:token), both on this PC's LAN address, valid 10 days.
 */
const LeadCapture = () => {
  const hitApi = useApi();
  const directDispatch = useDirect();
  const lanBase = useLanBase();
  const { leadPoints, isLoading } = useSelector((s) => s.mainReducer);

  const [tab, setTab] = useState('booth');
  const [dialog, setDialog] = useState(null); // { point|null, key }
  const [confirm, setConfirm] = useState(null); // { kind: 'point'|'link'|'checkout'|'eventLink', point }
  const [agendaFor, setAgendaFor] = useState(null); // room id whose agenda is open
  const [exporting, setExporting] = useState(false);
  const [screenFor, setScreenFor] = useState(null); // point whose scanner screen is being styled
  const [qr, setQr] = useState(null); // { url, title } shown as a QR code

  // No roles on the desktop — whoever uses this PC manages lead capture
  const perms = { create: true, edit: true, delete: true };
  const busy = isLoading === keyNames.leadPoints;

  const load = useCallback(
    () => hitApi(apiLeadPoints, null, method.get, keyNames.leadPoints, errorToast, { type: 'get' }),
    [hitApi]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Keep "in room now" fresh while looking at rooms
  useEffect(() => {
    if (tab !== 'room') return;
    const timer = setInterval(load, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [tab, load]);

  const points = (leadPoints || []).filter((p) => p.type === tab);
  const agendaRoom = agendaFor && (leadPoints || []).find((p) => p._id === agendaFor);
  const countOf = (type) => (leadPoints || []).filter((p) => p.type === type).length;

  const handleSave = (body) => {
    const editing = dialog.point;
    if (editing) {
      hitApi(`${apiLeadPoints}/${editing._id}`, body, method.put, keyNames.leadPoints, withToast(), {
        type: 'edit',
      });
    } else {
      hitApi(apiLeadPoints, { ...body, type: tab }, method.post, keyNames.leadPoints, withToast(), {
        type: 'add',
      });
    }
    setDialog(null);
  };

  const handleCreateLink = (point) =>
    hitApi(`${apiLeadPoints}/${point._id}/link`, null, method.post, keyNames.leadPoints, withToast(), {
      type: 'edit',
    });

  // Agenda changes come back as the updated room — swap it into the list
  const handleRoomUpdated = (room) =>
    directDispatch(
      (leadPoints || []).map((p) => (p._id === room._id ? room : p)),
      keyNames.leadPoints
    );

  const handleConfirm = () => {
    const { kind, point } = confirm;
    if (kind === 'eventLink') {
      hitApi(apiLeadLink, null, method.delete, keyNames.leadLink, withToast());
      setConfirm(null);
      return;
    }
    if (kind === 'checkout') {
      hitApi(`${apiLeadPoints}/${point._id}/checkout`, {}, method.post, keyNames.leadPoints, withToast(), {
        type: 'edit',
      });
      setConfirm(null);
      return;
    }
    const path = kind === 'link' ? `${apiLeadPoints}/${point._id}/link` : `${apiLeadPoints}/${point._id}`;
    hitApi(path, null, method.delete, keyNames.leadPoints, withToast(), {
      type: kind === 'link' ? 'edit' : 'delete',
    });
    setConfirm(null);
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      await downloadCsv({ type: tab, fallbackName: `lead-capture-all-${tab}s.csv` });
    } catch (err) {
      directDispatch(getToast('error', 'Export failed', err.message).error, keyNames.toastData);
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      directDispatch(
        getToast('success', 'Link copied', 'Scanner link copied to clipboard').success,
        keyNames.toastData
      );
    } catch (err) {
      console.error('Failed to copy scanner link:', err);
      directDispatch(
        getToast('error', 'Copy failed', 'Could not copy the scanner link').error,
        keyNames.toastData
      );
    }
  };

  return (
    <Box>
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
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
            Lead Capture
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#6b7280', mt: 0.3 }}>
            Track booth visits and session attendance by scanning badges
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RefreshButton loading={busy} tooltip="Refresh counts" onClick={load} />
          <Button
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExportAll}
            disabled={exporting || points.length === 0}
          >
            {exporting ? 'Exporting…' : 'Export all'}
          </Button>
          {perms.create && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialog({ point: null, key: Date.now() })}
            >
              {TABS[tab].add}
            </Button>
          )}
        </Box>
      </Box>

      <EventLinkBar
        perms={perms}
        onCopy={handleCopy}
        onDelete={() => setConfirm({ kind: 'eventLink' })}
        onShowQr={setQr}
        lanBase={lanBase}
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: '1px solid rgba(32,23,81,0.1)' }}
      >
        {Object.entries(TABS).map(([value, t]) => (
          <Tab
            key={value}
            value={value}
            label={`${t.label} (${countOf(value)})`}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          />
        ))}
      </Tabs>

      {leadPoints && points.length === 0 ? (
        <Box
          sx={{
            py: 8,
            textAlign: 'center',
            border: '1px dashed rgba(32,23,81,0.2)',
            borderRadius: '14px',
          }}
        >
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
            {TABS[tab].empty}
          </Typography>
          {perms.create && (
            <Button
              sx={{ mt: 1.5 }}
              startIcon={<AddIcon />}
              onClick={() => setDialog({ point: null, key: Date.now() })}
            >
              {TABS[tab].add}
            </Button>
          )}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 2,
          }}
        >
          {points.map((p) => (
            <PointCard
              key={p._id}
              point={p}
              perms={perms}
              busy={busy}
              onEdit={(point) => setDialog({ point, key: Date.now() })}
              onDelete={(point) => setConfirm({ kind: 'point', point })}
              onCreateLink={handleCreateLink}
              onDeleteLink={(point) => setConfirm({ kind: 'link', point })}
              onCopy={handleCopy}
              onCheckoutAll={(point) => setConfirm({ kind: 'checkout', point })}
              onScreenSettings={setScreenFor}
              onAgenda={(point) => setAgendaFor(point._id)}
              onShowQr={setQr}
              lanBase={lanBase}
            />
          ))}
        </Box>
      )}

      {dialog && (
        <PointDialog
          key={dialog.key}
          open
          type={tab}
          point={dialog.point}
          onClose={() => setDialog(null)}
          onSave={handleSave}
        />
      )}

      {agendaRoom && (
        <AgendaDialog
          room={agendaRoom}
          canEdit={perms.edit}
          onClose={() => setAgendaFor(null)}
          onRoomUpdated={handleRoomUpdated}
        />
      )}

      <ScreenSettingsDialog
        open={Boolean(screenFor)}
        onClose={() => setScreenFor(null)}
        path={screenFor ? apiLeadScreen(screenFor._id) : ''}
        heading={screenFor ? `${screenFor.name} — scanner screen` : ''}
        defaults={screenFor ? screenDefaults(screenFor) : {}}
      />

      <LinkQrDialog qr={qr} onClose={() => setQr(null)} onCopy={handleCopy} />

      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} onConfirm={handleConfirm} />
    </Box>
  );
};

// What the scanner shows when the title / description are left empty
const screenDefaults = (p) => ({
  title: p.name,
  description: p.type === 'room' ? 'Current session' : p.exhibitorName || 'Booth lead capture',
});

const CONFIRM_TEXT = {
  eventLink: () => ({
    title: 'Delete universal scanner link?',
    body: 'Every device using it will stop scanning. Scans already recorded are kept, and booth / room links keep working.',
    action: 'Delete',
    color: 'error',
  }),
  link: () => ({
    title: 'Delete scanner link?',
    body: 'Any device using this link will stop scanning. Scans already recorded are kept, and you can create a new link afterwards.',
    action: 'Delete',
    color: 'error',
  }),
  point: (p) => ({ title: `Delete ${p.name}?`, body: 'This cannot be undone.', action: 'Delete', color: 'error' }),
  checkout: (p) => ({
    title: `Check out everyone in ${p.name}?`,
    body: `${p.liveCount} ${p.liveCount === 1 ? 'person' : 'people'} will get an out entry at the current time. Anyone scanned again afterwards is checked back in.`,
    action: 'Check out all',
    color: 'warning',
  }),
};

const ConfirmDialog = ({ confirm, onClose, onConfirm }) => {
  const text = confirm ? CONFIRM_TEXT[confirm.kind](confirm.point) : null;
  return (
    <Dialog open={Boolean(confirm)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{text?.title}</DialogTitle>
      <DialogContent sx={{ fontSize: 14, color: '#374151' }}>{text?.body}</DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color={text?.color} onClick={onConfirm}>
          {text?.action}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LeadCapture;
