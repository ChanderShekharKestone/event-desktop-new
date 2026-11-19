import { Alert, AlertTitle, Typography } from '@mui/material';

const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// What each scan outcome from POST /public/lead/:token/scan looks like on screen
const RESULTS = {
  // booth
  visited: { severity: 'success', title: () => 'New lead captured' },
  revisited: { severity: 'success', title: (d) => `Visited again · ${d.visitCount} visits` },
  // room
  entered: { severity: 'success', title: () => 'IN' },
  moved: { severity: 'success', title: (d) => `IN · moved from ${d.movedFrom}` },
  exited: { severity: 'warning', title: (d) => `OUT · ${d.minutes} min in room` },
  'already-in': { severity: 'info', title: (d) => `Already IN since ${fmtTime(d.since)}` },
  'not-in': { severity: 'warning', title: () => 'Not in this room' },
  'in-other-room': { severity: 'warning', title: (d) => `Not in this room — IN ${d.fromRoom}` },
  cancelled: { severity: 'info', title: () => 'Cancelled — nothing saved' },
  // both
  duplicate: { severity: 'info', title: () => 'Already scanned just now' },
};

/** Big banner for the last scan — `scan` is { data } on success or { error } on failure */
const ScanResult = ({ scan }) => {
  if (!scan) return null;

  if (scan.error) {
    return (
      <Alert severity="error" variant="filled" sx={{ fontSize: 16, alignItems: 'center' }}>
        <AlertTitle sx={{ fontSize: 18, fontWeight: 700, mb: 0 }}>{scan.error}</AlertTitle>
      </Alert>
    );
  }

  const { data } = scan;
  const config = RESULTS[data.result] || { severity: 'info', title: () => 'Scanned' };
  const sub = [
    data.attendee?.designation,
    data.attendee?.organization,
    data.session && ['entered', 'moved'].includes(data.result) && `Session: ${data.session}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Alert severity={config.severity} variant="filled" sx={{ alignItems: 'center' }}>
      <AlertTitle sx={{ fontSize: 20, fontWeight: 700, mb: 0.25 }}>{data.attendee?.name}</AlertTitle>
      <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{config.title(data)}</Typography>
      {sub && <Typography sx={{ fontSize: 13, opacity: 0.9, mt: 0.25 }}>{sub}</Typography>}
    </Alert>
  );
};

export default ScanResult;
