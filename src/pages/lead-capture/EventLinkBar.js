import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Box, Button, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import AddLinkIcon from '@mui/icons-material/AddLink';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { apiLeadLink, method } from '../../apiPath';
import keyNames from '../../keyName';
import { useApi } from '../../hooks';
import { getToast } from '../../common/utils';

const withToast = () => ({ ...getToast('success', null, keyNames.apiMsg), ...getToast('error') });

export const eventScannerUrl = (link, lanBase) =>
  link?.scanToken && lanBase ? `${lanBase}/#/lead-scan/${link.scanToken}` : null;

const fmtExpiry = (d) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * The event-wide scanner link: volunteers open it on any device and pick the booth,
 * or the room and session, they are scanning at. Valid 10 days, like the kiosk.
 */
const EventLinkBar = ({ perms, onCopy, onDelete, onShowQr, lanBase }) => {
  const hitApi = useApi();
  const { leadLink, isLoading } = useSelector((s) => s.mainReducer);
  const busy = isLoading === keyNames.leadLink;
  const url = eventScannerUrl(leadLink, lanBase);

  useEffect(() => {
    hitApi(apiLeadLink, null, method.get, keyNames.leadLink, getToast('error'));
  }, [hitApi]);

  const handleCreate = () => hitApi(apiLeadLink, null, method.post, keyNames.leadLink, withToast());

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: '14px',
        border: '1px solid rgba(32,23,81,0.1)',
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '10px',
          background: 'rgba(32,23,81,0.07)',
          color: '#201751',
          display: { xs: 'none', sm: 'flex' },
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <QrCodeScannerIcon />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Universal scanner link</Typography>
        {url ? (
          <Typography sx={{ fontSize: 12, color: '#6b7280', mt: 0.25, wordBreak: 'break-all' }}>
            <Box component="span" sx={{ color: '#201751', fontWeight: 600 }}>
              {url}
            </Box>{' '}
            · valid until {fmtExpiry(leadLink.tokenExpiresAt)}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: 13, color: '#6b7280', mt: 0.25 }}>
            {leadLink?.scanToken
              ? "Finding this PC's network address…"
              : 'One link for every volunteer (phones on the same Wi-Fi as this PC): they choose the booth, or the room and session, on their device.'}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
        {url ? (
          <>
            <Button variant="contained" size="small" startIcon={<ContentCopyIcon />} onClick={() => onCopy(url)}>
              Copy link
            </Button>
            <Tooltip title="Show QR code">
              <IconButton size="small" onClick={() => onShowQr({ url, title: 'Universal scanner link' })}>
                <QrCode2Icon fontSize="small" />
              </IconButton>
            </Tooltip>
            {perms.delete && (
              <Tooltip title="Delete link">
                <IconButton size="small" color="error" onClick={onDelete} disabled={busy}>
                  <LinkOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </>
        ) : (
          perms.create && (
            <Button variant="contained" size="small" startIcon={<AddLinkIcon />} onClick={handleCreate} disabled={busy}>
              Create link
            </Button>
          )
        )}
      </Box>
    </Paper>
  );
};

export default EventLinkBar;
