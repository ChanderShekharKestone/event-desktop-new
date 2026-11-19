import { Box, Chip, Tooltip } from '@mui/material';

const KIND = { point: 'Booth / room', session: 'Session', visit: 'Scan', lead: 'Lead' };

/**
 * Cloud sync chips for Lead Capture (desktop only): changes not on the cloud yet (some
 * waiting for the delegate's registration to reach the cloud first) and ones it refused.
 */
const SyncStatus = ({ sync }) => {
  const { pending = 0, waiting = 0, rejected = [] } = sync || {};
  if (!pending && !rejected.length) return null;
  return (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
      {pending > 0 && (
        <Tooltip
          title={
            waiting > 0
              ? `${waiting} waiting for the delegate's registration to reach the cloud`
              : 'Saved on this PC — goes to the cloud on the next sync'
          }
        >
          <Chip
            size="small"
            label={`${pending} not synced`}
            sx={{ fontSize: 11, fontWeight: 600, color: '#A16207', background: '#FEF9C3' }}
          />
        </Tooltip>
      )}
      {rejected.length > 0 && (
        <Tooltip
          title={
            <Box>
              {rejected.slice(0, 8).map((r) => (
                <div key={`${r.kind}-${r._id}`}>
                  {KIND[r.kind] || r.kind}: {r.reason}
                </div>
              ))}
              {rejected.length > 8 && <div>…and {rejected.length - 8} more</div>}
              <div style={{ marginTop: 4 }}>Editing a booth / room / session sends it again.</div>
            </Box>
          }
        >
          <Chip
            size="small"
            label={`${rejected.length} rejected by cloud`}
            sx={{ fontSize: 11, fontWeight: 600, color: '#dc2626', background: '#fee2e2' }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default SyncStatus;
