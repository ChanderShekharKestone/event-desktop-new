import { Button, CircularProgress, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * Page-level "Refresh" button — re-fetches only that page's data.
 * Same look as the Delegates toolbar buttons (Add delegate / Export CSV).
 */
const RefreshButton = ({ onClick, loading = false, tooltip = 'Refresh', label = 'Refresh' }) => (
  <Tooltip title={tooltip}>
    <span>
      <Button
        size="small"
        variant="outlined"
        disabled={loading}
        onClick={onClick}
        startIcon={
          loading ? (
            <CircularProgress size={14} sx={{ color: '#201751' }} />
          ) : (
            <RefreshIcon sx={{ fontSize: 16 }} />
          )
        }
        sx={{
          height: 34,
          px: 1.75,
          fontSize: 13,
          fontWeight: 600,
          textTransform: 'none',
          color: '#201751',
          background: '#fff',
          border: '1px solid rgba(32,23,81,0.3)',
          borderRadius: 1.5,
          whiteSpace: 'nowrap',
          '&:hover': { background: 'rgba(32,23,81,0.06)', borderColor: '#201751' },
          '&.Mui-disabled': { color: 'rgba(32,23,81,0.6)', borderColor: 'rgba(32,23,81,0.2)' },
        }}
      >
        {loading ? 'Refreshing…' : label}
      </Button>
    </span>
  </Tooltip>
);

export default RefreshButton;
