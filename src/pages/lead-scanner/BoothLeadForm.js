import { useState } from 'react';
import axios from 'axios';
import { Box, Button, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { apiPath } from '../../apiPath';

const RATINGS = [
  { value: 'hot', label: 'Hot', color: '#dc2626' },
  { value: 'warm', label: 'Warm', color: '#ea580c' },
  { value: 'cold', label: 'Cold', color: '#2563eb' },
];

/**
 * Optional rating + note for the lead just scanned at a booth. Rating saves on tap
 * (tap again to clear); the note has its own Save. Remount with a new `key` per scan.
 */
const BoothLeadForm = ({ base, attendeeId, initialRating, initialNote }) => {
  const [rating, setRating] = useState(initialRating || null);
  const [note, setNote] = useState(initialNote || '');
  const [savedNote, setSavedNote] = useState(initialNote || '');
  const [status, setStatus] = useState({ saving: false, error: '' });

  const save = async (body) => {
    setStatus({ saving: true, error: '' });
    try {
      const res = await axios.post(apiPath + base + '/rate', { attendeeId, ...body });
      setStatus({ saving: false, error: '' });
      return res.data.data;
    } catch (err) {
      setStatus({ saving: false, error: err.response?.data?.message || 'Could not save. Try again.' });
      return null;
    }
  };

  const handleRating = async (_, value) => {
    const previous = rating;
    setRating(value); // value is null when the selected rating is tapped again
    if (!(await save({ rating: value }))) setRating(previous);
  };

  const handleNote = async () => {
    const saved = await save({ note });
    if (saved) setSavedNote(saved.note);
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#6b7280', mb: 1 }}>
        Rate this lead (optional)
      </Typography>
      <ToggleButtonGroup exclusive fullWidth value={rating} onChange={handleRating} disabled={status.saving}>
        {RATINGS.map((r) => (
          <ToggleButton
            key={r.value}
            value={r.value}
            sx={{
              py: 1.5,
              fontWeight: 700,
              fontSize: 15,
              '&.Mui-selected, &.Mui-selected:hover': { bgcolor: r.color, color: '#fff' },
            }}
          >
            {r.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Note (e.g. wants a demo)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
        />
        <Button
          variant="outlined"
          onClick={handleNote}
          disabled={status.saving || note.trim() === savedNote}
        >
          Save
        </Button>
      </Box>
      {status.error && (
        <Typography sx={{ fontSize: 13, color: '#dc2626', mt: 1 }}>{status.error}</Typography>
      )}
    </Box>
  );
};

export default BoothLeadForm;
