import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChartOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import AddLinkIcon from '@mui/icons-material/AddLink';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import { agendaStatus } from './agenda';

const RATING_CHIPS = [
  { key: 'hot', label: 'Hot', color: '#dc2626', bg: '#fee2e2' },
  { key: 'warm', label: 'Warm', color: '#c2410c', bg: '#ffedd5' },
  { key: 'cold', label: 'Cold', color: '#1d4ed8', bg: '#dbeafe' },
];

const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

// Scanner page on this PC's LAN address (phones / tablets on the same network)
export const scannerUrl = (point, lanBase) =>
  point.scanToken && lanBase ? `${lanBase}/#/lead/${point.scanToken}` : null;

const Stat = ({ value, label }) => (
  <Box>
    <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1.1 }}>{value}</Typography>
    <Typography sx={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </Typography>
  </Box>
);

/** One booth / room with its stats, agenda line and scanner link actions */
const PointCard = ({
  point,
  perms,
  busy,
  onEdit,
  onDelete,
  onCreateLink,
  onDeleteLink,
  onCopy,
  onCheckoutAll,
  onScreenSettings,
  onAgenda,
  onShowQr,
  lanBase,
}) => {
  const isRoom = point.type === 'room';
  const url = scannerUrl(point, lanBase);
  const agenda = point.agenda || [];
  const now = agendaStatus(agenda);
  const subtitle = isRoom
    ? [agenda.length ? `${agenda.length} ${agenda.length === 1 ? 'session' : 'sessions'}` : 'No sessions yet']
    : [point.exhibitorName];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: '14px',
        border: '1px solid rgba(32,23,81,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.75,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#111827' }} noWrap>
              {point.name}
            </Typography>
            {now?.label === 'Now' && (
              <Chip
                size="small"
                label="Live"
                sx={{ height: 20, fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7' }}
              />
            )}
          </Box>
          {subtitle.filter(Boolean).length > 0 && (
            <Typography sx={{ fontSize: 13, color: '#6b7280', mt: 0.25 }} noWrap>
              {subtitle.filter(Boolean).join(' · ')}
            </Typography>
          )}
        </Box>
        <Tooltip title="View report">
          <IconButton size="small" component={RouterLink} to={`/app/lead-capture/${point._id}`}>
            <BarChartIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {perms.edit && (
          <Tooltip title="Scanner screen settings">
            <IconButton size="small" onClick={() => onScreenSettings(point)}>
              <SettingsOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {perms.edit && (
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => onEdit(point)} disabled={busy}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {perms.delete && (
          <Tooltip title={point.totalScans ? "Has scans — can't be deleted" : 'Delete'}>
            {/* span keeps the tooltip working on a disabled button */}
            <span>
              <IconButton
                size="small"
                onClick={() => onDelete(point)}
                disabled={busy || point.totalScans > 0}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {isRoom ? (
          <>
            <Stat
              value={point.capacity ? `${point.liveCount} / ${point.capacity}` : point.liveCount}
              label="In room now"
            />
            <Stat value={point.uniqueAttendees} label="Attended" />
            {perms.edit && point.liveCount > 0 && (
              <Button
                size="small"
                color="warning"
                variant="outlined"
                startIcon={<LogoutIcon />}
                onClick={() => onCheckoutAll(point)}
                disabled={busy}
                sx={{ alignSelf: 'center', ml: 'auto' }}
              >
                Check out all
              </Button>
            )}
          </>
        ) : (
          <>
            <Stat value={point.uniqueAttendees} label="Leads" />
            <Stat value={point.totalScans} label="Total visits" />
          </>
        )}
      </Box>

      {isRoom && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, color: now ? '#111827' : '#9ca3af' }} noWrap>
            {now ? (
              <>
                <Box component="span" sx={{ fontWeight: 700, color: now.label === 'Now' ? '#16a34a' : '#201751' }}>
                  {now.label}:
                </Box>{' '}
                {now.text}
              </>
            ) : (
              'Nothing on right now'
            )}
          </Typography>
          <Button size="small" startIcon={<EventNoteOutlinedIcon />} onClick={() => onAgenda(point)} sx={{ flexShrink: 0 }}>
            Agenda
          </Button>
        </Box>
      )}

      {!isRoom && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {RATING_CHIPS.map((r) => (
            <Chip
              key={r.key}
              size="small"
              label={`${r.label}: ${point.ratings?.[r.key] || 0}`}
              sx={{ fontSize: 11, fontWeight: 600, color: r.color, background: r.bg }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ pt: 1.5, borderTop: '1px solid rgba(32,23,81,0.07)' }}>
        {point.scanToken && !url ? (
          <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>Finding this PC's network address…</Typography>
        ) : url ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                sx={{ flex: 1, minWidth: 0, fontSize: 12, color: '#201751', fontWeight: 600 }}
                noWrap
                title={url}
              >
                {url}
              </Typography>
              <Tooltip title="Copy scanner link">
                <IconButton size="small" onClick={() => onCopy(url)}>
                  <ContentCopyIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Show QR code">
                <IconButton size="small" onClick={() => onShowQr({ url, title: `${point.name} — scanner` })}>
                  <QrCode2Icon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              {perms.delete && (
                <Tooltip title="Delete scanner link">
                  <IconButton size="small" color="error" onClick={() => onDeleteLink(point)} disabled={busy}>
                    <LinkOffIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            <Typography sx={{ fontSize: 11, color: '#6b7280', mt: 0.25 }}>
              Valid until {fmtTime(point.tokenExpiresAt)}
            </Typography>
          </>
        ) : perms.create ? (
          <Button size="small" startIcon={<AddLinkIcon />} onClick={() => onCreateLink(point)} disabled={busy}>
            Create scanner link
          </Button>
        ) : (
          <Typography sx={{ fontSize: 12, color: '#9ca3af' }}>No scanner link</Typography>
        )}
      </Box>
    </Paper>
  );
};

export default PointCard;
