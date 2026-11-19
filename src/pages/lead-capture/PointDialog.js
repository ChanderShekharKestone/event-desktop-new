import { useState } from 'react';
import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import Dialog from '../../component/Dialog';

const emptyForm = (point) => ({
  name: point?.name || '',
  exhibitorName: point?.exhibitorName || '',
  capacity: point?.capacity ?? '',
});

/**
 * Create / edit a booth or room. `point` is null when creating.
 * A room's sessions are managed separately (Agenda). Remount with a new `key` each time it opens.
 */
const PointDialog = ({ open, type, point, onClose, onSave }) => {
  const [form, setForm] = useState(() => emptyForm(point));
  const [touched, setTouched] = useState(false);
  const isRoom = type === 'room';
  const label = isRoom ? 'room' : 'booth';

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const errors = {
    name: !form.name.trim() && 'Name is required',
    capacity:
      isRoom &&
      form.capacity !== '' &&
      !(Number.isInteger(Number(form.capacity)) && Number(form.capacity) >= 0) &&
      'Enter a whole number',
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const handleSave = () => {
    setTouched(true);
    if (hasErrors) return;
    onSave(
      isRoom
        ? { name: form.name.trim(), capacity: form.capacity === '' ? null : Number(form.capacity) }
        : { name: form.name.trim(), exhibitorName: form.exhibitorName.trim() }
    );
  };

  const fieldError = (key) => (touched && errors[key]) || '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>
        {point ? `Edit ${label}` : `Add ${label}`}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label={isRoom ? 'Room name' : 'Booth name'}
            placeholder={isRoom ? 'e.g. Room 1, Hall A' : undefined}
            value={form.name}
            onChange={set('name')}
            error={Boolean(fieldError('name'))}
            helperText={fieldError('name')}
            autoFocus
            fullWidth
            size="small"
          />
          {isRoom ? (
            <TextField
              label="Capacity (optional)"
              type="number"
              value={form.capacity}
              onChange={set('capacity')}
              error={Boolean(fieldError('capacity'))}
              helperText={fieldError('capacity') || 'Add the sessions from Agenda after saving'}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { min: 0 } }}
            />
          ) : (
            <TextField
              label="Exhibitor / company (optional)"
              value={form.exhibitorName}
              onChange={set('exhibitorName')}
              fullWidth
              size="small"
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={touched && hasErrors}>
          {point ? 'Save' : `Add ${label}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PointDialog;
