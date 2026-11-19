import { Box, Button, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import Dialog from './Dialog';
import QRCode from 'react-qr-code';

/**
 * A LAN link as a QR code (lead capture scanners, scan kiosk) — point a phone camera at it.
 * Desktop only: the app window can't open browser tabs, and phones need the link anyway.
 * `qr` is { url, title } or null.
 */
const LinkQrDialog = ({ qr, onClose, onCopy }) => (
  <Dialog open={Boolean(qr)} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{qr?.title}</DialogTitle>
    <DialogContent sx={{ textAlign: 'center' }}>
      {qr && (
        <>
          <Box sx={{ display: 'inline-flex', p: 2, background: '#fff', borderRadius: 2, border: '1px solid #e5e7eb' }}>
            <QRCode value={qr.url} size={220} />
          </Box>
          <Typography sx={{ fontSize: 12, color: '#201751', fontWeight: 600, mt: 1.5, wordBreak: 'break-all' }}>
            {qr.url}
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#6b7280', mt: 1 }}>
            The device must be on the same Wi-Fi as this PC. It may warn about the security certificate
            the first time — choose to continue (it's this PC's own certificate).
          </Typography>
        </>
      )}
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={() => onCopy(qr.url)}>Copy link</Button>
      <Button variant="contained" onClick={onClose}>
        Done
      </Button>
    </DialogActions>
  </Dialog>
);

export default LinkQrDialog;
