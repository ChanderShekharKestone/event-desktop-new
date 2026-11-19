import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import Dialog from '../../component/Dialog';
import SearchIcon from '@mui/icons-material/Search';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { apiScanDelegates, method } from '../../apiPath';
import keyNames from '../../keyName';
import { useApi, useDirect } from '../../hooks';

const MIN_CHARS = 2;

/**
 * Free-text search — matches name, email, organization, designation, type, mobile
 * or badge id and lists results with a Print button (email / mobile come back masked).
 * Ported from vosmos-events-client. Used on this PC and on LAN kiosk screens.
 */
const SearchDelegates = ({ onPrint, disabled }) => {
  const hitApi = useApi();
  const directDispatch = useDirect();
  const { scanSearchResults, isLoading } = useSelector((s) => s.mainReducer);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [reprintTarget, setReprintTarget] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < MIN_CHARS) {
      directDispatch(null, keyNames.scanSearchResults);
      return;
    }
    hitApi(
      `${apiScanDelegates}?q=${encodeURIComponent(debounced)}&limit=10`,
      null,
      method.get,
      keyNames.scanSearchResults,
      null
    );
  }, [debounced, hitApi, directDispatch]);

  // Clear results when leaving search mode / after printing
  useEffect(() => () => directDispatch(null, keyNames.scanSearchResults), [directDispatch]);

  const searching = isLoading === keyNames.scanSearchResults;
  const printing = isLoading === keyNames.userScanData;
  const results = scanSearchResults || [];
  const showResults = debounced.length >= MIN_CHARS;

  const handlePrintClick = (d) => {
    if (d.isPrintClicked) setReprintTarget(d);
    else onPrint(d._id, true);
  };

  const confirmReprint = () => {
    onPrint(reprintTarget._id, true);
    setReprintTarget(null);
  };

  return (
    <Box sx={{ width: '100%', mt: 1 }}>
      <TextField
        fullWidth
        autoFocus
        size="small"
        placeholder="Name, email, organization, designation, type, badge id…"
        value={query}
        disabled={disabled}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: '#9ca3af' }} />
              </InputAdornment>
            ),
            endAdornment: searching && (
              <InputAdornment position="end">
                <CircularProgress size={16} />
              </InputAdornment>
            ),
          },
        }}
      />

      {showResults && (
        <Box
          sx={{
            mt: 1.5,
            border: '1px solid #e5e7eb',
            borderRadius: 2,
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          {!searching && results.length === 0 && (
            <Typography sx={{ p: 3, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
              No delegates found
            </Typography>
          )}
          {results.map((d) => {
            const sub = [d.organization, d.designation].filter(Boolean).join(' · ');
            return (
              <Box
                key={d._id}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  borderBottom: '1px solid #f1f5f9',
                  '&:last-of-type': { borderBottom: 'none' },
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#111827' }} noWrap>
                    {`${d.firstName || ''} ${d.lastName || ''}`.trim() || '—'}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#6b7280' }} noWrap>
                    {[d.email, d.mobile].filter(Boolean).join(' · ')}
                  </Typography>
                  {sub && (
                    <Typography sx={{ fontSize: 12, color: '#6b7280' }} noWrap>
                      {sub}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    {d.type && (
                      <Chip
                        size="small"
                        label={d.type}
                        sx={{ height: 20, fontSize: 11, textTransform: 'capitalize' }}
                      />
                    )}
                    {d.isCheckedIn && (
                      <Chip
                        size="small"
                        label="Checked in"
                        sx={{ height: 20, fontSize: 11, background: '#d1fae5', color: '#059669' }}
                      />
                    )}
                  </Box>
                </Box>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PrintOutlinedIcon sx={{ fontSize: 16 }} />}
                  disabled={disabled || printing}
                  onClick={() => handlePrintClick(d)}
                  sx={{ flexShrink: 0, textTransform: 'none' }}
                >
                  {d.isPrintClicked ? 'Re-print' : 'Print'}
                </Button>
              </Box>
            );
          })}
        </Box>
      )}

      <Dialog open={!!reprintTarget} onClose={() => setReprintTarget(null)}>
        <DialogTitle>Print again?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This badge has already been printed. Would you like to print it again?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReprintTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmReprint} autoFocus>
            Print again
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SearchDelegates;
