import { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { apiPath, apiLeadAgenda } from '../../apiPath';
import keyNames from '../../keyName';
import { useDirect } from '../../hooks';
import { getToast } from '../../common/utils';
import { fmtClock, fromInput, groupByDay, runningSession, toInput } from './agenda';

const DEFAULT_LENGTH_MIN = 30;

// New sessions start where the last one ended, so an agenda is quick to type in
const blankForm = (agenda) => {
  const last = agenda.at(-1);
  const start = last ? new Date(last.endTime) : null;
  return {
    id: null,
    title: '',
    speaker: '',
    startTime: toInput(start),
    endTime: start ? toInput(new Date(start.getTime() + DEFAULT_LENGTH_MIN * 60000)) : '',
    actualStartTime: '',
    actualEndTime: '',
  };
};

/**
 * A room's agenda: its sessions in time order, with add / edit / delete for editors.
 * `room` is the live room from the list, so it updates after each change.
 */
const AgendaDialog = ({ room, canEdit, onClose, onRoomUpdated }) => {
  const directDispatch = useDirect();
  const agenda = room.agenda || [];
  const [form, setForm] = useState(() => blankForm(agenda));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // session id

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      // Moving the start keeps the session length
      if (key === 'startTime' && f.startTime && f.endTime && value) {
        const length = new Date(f.endTime) - new Date(f.startTime);
        return { ...f, startTime: value, endTime: toInput(new Date(new Date(value).getTime() + length)) };
      }
      return { ...f, [key]: value };
    });
  };

  const errors = {
    title: !form.title.trim() && 'Title is required',
    startTime: !form.startTime && 'Required',
    endTime:
      (!form.endTime && 'Required') ||
      (form.startTime && new Date(form.endTime) <= new Date(form.startTime) && 'Must be after the start'),
    actualStartTime: form.actualEndTime && !form.actualStartTime && 'Needed when there is an actual end',
    actualEndTime:
      form.actualStartTime &&
      form.actualEndTime &&
      new Date(form.actualEndTime) <= new Date(form.actualStartTime) &&
      'Must be after the actual start',
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const fieldError = (key) => (touched && errors[key]) || '';

  const request = async (fn, success) => {
    setSaving(true);
    try {
      const res = await fn();
      onRoomUpdated(res.data.data);
      directDispatch(getToast('success', success, res.data.message).success, keyNames.toastData);
      return res.data.data;
    } catch (err) {
      directDispatch(
        getToast('error', 'Not saved', err.response?.data?.message || 'Try again').error,
        keyNames.toastData
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setTouched(true);
    if (hasErrors) return;
    const body = {
      title: form.title.trim(),
      speaker: form.speaker.trim(),
      startTime: fromInput(form.startTime),
      endTime: fromInput(form.endTime),
      // Only editing sends actual times (new sessions haven't run yet)
      ...(form.id && {
        actualStartTime: fromInput(form.actualStartTime),
        actualEndTime: fromInput(form.actualEndTime),
      }),
    };
    const updated = await request(
      () =>
        form.id
          ? axios.put(`${apiPath}${apiLeadAgenda(room._id)}/${form.id}`, body)
          : axios.post(apiPath + apiLeadAgenda(room._id), body),
      form.id ? 'Session updated' : 'Session added'
    );
    if (updated) {
      setForm(blankForm(updated.agenda));
      setTouched(false);
    }
  };

  const handleDelete = async (id) => {
    setConfirmDelete(null);
    const updated = await request(
      () => axios.delete(`${apiPath}${apiLeadAgenda(room._id)}/${id}`),
      'Session deleted'
    );
    if (updated && form.id === id) setForm(blankForm(updated.agenda));
  };

  const startEdit = (s) => {
    setTouched(false);
    setForm({
      id: s._id,
      title: s.title,
      speaker: s.speaker || '',
      startTime: toInput(s.startTime),
      endTime: toInput(s.endTime),
      actualStartTime: toInput(s.actualStartTime),
      actualEndTime: toInput(s.actualEndTime),
    });
  };

  const live = runningSession(agenda);

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 0.5 }}>{room.name} — agenda</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: '#6b7280', mb: 2 }}>
          Volunteers start each session on the room scanner when it actually begins. Someone in
          the room for at least half of the session as it actually ran attended it.
        </Typography>

        {agenda.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center', border: '1px dashed rgba(32,23,81,0.2)', borderRadius: 2, mb: 2 }}>
            <Typography sx={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>No sessions yet</Typography>
            {canEdit && (
              <Typography sx={{ fontSize: 13, color: '#6b7280' }}>Add the first one below.</Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            {groupByDay(agenda).map((g) => (
              <Box key={g.day}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.5 }}>
                  {g.day}
                </Typography>
                {g.sessions.map((s, i) => {
                  const editing = form.id === s._id;
                  const isLive = live?._id === s._id;
                  return (
                    <Box
                      key={s._id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 1,
                        px: 1.25,
                        borderRadius: 1.5,
                        background: editing ? 'rgba(32,23,81,0.06)' : 'transparent',
                        borderTop: i ? '1px solid rgba(32,23,81,0.07)' : 'none',
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#201751', width: 112, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtClock(s.startTime)} – {fmtClock(s.endTime)}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#111827' }} noWrap>
                          {s.title}
                          {isLive && (
                            <Box component="span" sx={{ ml: 1, fontSize: 11, fontWeight: 700, color: '#16a34a' }}>
                              ● Live
                            </Box>
                          )}
                        </Typography>
                        {(s.speaker || s.actualStartTime) && (
                          <Typography sx={{ fontSize: 12, color: '#6b7280' }} noWrap>
                            {[
                              s.speaker,
                              s.actualStartTime &&
                                `Actual ${fmtClock(s.actualStartTime)} – ${s.actualEndTime ? fmtClock(s.actualEndTime) : 'now'}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Typography>
                        )}
                      </Box>
                      {canEdit &&
                        (confirmDelete === s._id ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontSize: 12, color: '#374151' }}>Delete?</Typography>
                            <Button size="small" color="error" onClick={() => handleDelete(s._id)} disabled={saving}>
                              Yes
                            </Button>
                            <Button size="small" onClick={() => setConfirmDelete(null)}>
                              No
                            </Button>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex' }}>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => startEdit(s)} disabled={saving}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" onClick={() => setConfirmDelete(s._id)} disabled={saving}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ))}
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>
        )}

        {canEdit && (
          <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(32,23,81,0.12)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
              {form.id ? 'Edit session' : 'Add session'}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField
                label="Title"
                placeholder="e.g. Evolution of AI"
                value={form.title}
                onChange={set('title')}
                error={Boolean(fieldError('title'))}
                helperText={fieldError('title')}
                size="small"
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                label="Speaker (optional)"
                value={form.speaker}
                onChange={set('speaker')}
                size="small"
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                label="Start"
                type="datetime-local"
                value={form.startTime}
                onChange={set('startTime')}
                error={Boolean(fieldError('startTime'))}
                helperText={fieldError('startTime')}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="End"
                type="datetime-local"
                value={form.endTime}
                onChange={set('endTime')}
                error={Boolean(fieldError('endTime'))}
                helperText={fieldError('endTime')}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
              />
              {form.id && (
                <>
                  <TextField
                    label="Actual start"
                    type="datetime-local"
                    value={form.actualStartTime}
                    onChange={(e) => setForm((f) => ({ ...f, actualStartTime: e.target.value }))}
                    error={Boolean(fieldError('actualStartTime'))}
                    helperText={fieldError('actualStartTime') || 'Set by the scanner; clear if it never ran'}
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="Actual end"
                    type="datetime-local"
                    value={form.actualEndTime}
                    onChange={(e) => setForm((f) => ({ ...f, actualEndTime: e.target.value }))}
                    error={Boolean(fieldError('actualEndTime'))}
                    helperText={fieldError('actualEndTime') || 'Empty while it is running'}
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </>
              )}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              {form.id && (
                <Button onClick={() => setForm(blankForm(agenda))} disabled={saving}>
                  Cancel edit
                </Button>
              )}
              <Button variant="contained" onClick={handleSave} disabled={saving || (touched && hasErrors)}>
                {saving ? 'Saving…' : form.id ? 'Save session' : 'Add session'}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AgendaDialog;
