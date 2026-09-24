import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Checkbox,
  FormControlLabel,
  Alert,
} from "@mui/material";
import { Backup, Restore, DeleteForever, CheckCircle } from "@mui/icons-material";
import axios from "axios";
import {
  apiPath,
  apiAppResetSummary,
  apiAppResetExport,
  apiAppResetRestore,
  apiAppResetChallenge,
  apiAppResetWipe,
} from "../../apiPath";

const cardSx = {
  bgcolor: "#fff",
  borderRadius: "12px",
  border: "1px solid rgba(32,23,81,0.12)",
  p: 3,
  mt: 3,
};

const btnSx = {
  borderRadius: "10px",
  px: 3,
  py: 1.25,
  fontWeight: 600,
  textTransform: "none",
};

const errMsg = (err, fallback) => err.response?.data?.message || fallback;

// ── Export helper shared by the Backup section and the Clean dialog ────────────
const useExport = (notify) => {
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  const exportBackup = async () => {
    setExporting(true);
    try {
      const { data } = await axios.post(apiPath + apiAppResetExport);
      if (data.data?.canceled) return null;
      setLastExport(data.data);
      notify("success", data.message);
      return data.data;
    } catch (err) {
      notify("error", errMsg(err, "Export failed"));
      return null;
    } finally {
      setExporting(false);
    }
  };

  return { exporting, lastExport, exportBackup };
};

const LocalDriveWarning = ({ info }) =>
  info?.onLocalDrive ? (
    <Alert severity="warning" sx={{ mt: 2 }}>
      Saved on this laptop's own drive ({info.folder}). <b>Clean All Data will not delete it</b>. Move the
      backup to a USB or company drive before returning the laptop.
    </Alert>
  ) : info ? (
    <Alert severity="success" sx={{ mt: 2 }}>
      Saved to {info.folder}
    </Alert>
  ) : null;

// ── Clean All Data dialog ──────────────────────────────────────────────────────
const CleanDialog = ({ open, onClose, notify, exportBackup, exporting }) => {
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null); // { code, expiresInSec, ...summary }
  const [blocked, setBlocked] = useState(null); // message when pending pushes exist
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [backupInfo, setBackupInfo] = useState(null);
  const [skipBackup, setSkipBackup] = useState(false);
  const [typed, setTyped] = useState("");
  const [wiping, setWiping] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const getChallenge = async () => {
    setLoading(true);
    setError("");
    setTyped("");
    try {
      const { data } = await axios.post(apiPath + apiAppResetChallenge);
      setChallenge(data.data);
      setBlocked(null);
      setExpiresAt(Date.now() + data.data.expiresInSec * 1000);
    } catch (err) {
      setChallenge(null);
      setBlocked(errMsg(err, "Could not start clean"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setBackupInfo(null);
    setSkipBackup(false);
    setResult(null);
    getChallenge();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !challenge) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open, challenge]);

  const secondsLeft = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const expired = challenge && secondsLeft === 0;
  const backupStepDone = !!backupInfo || skipBackup;
  const codeMatches = challenge && typed.trim().toUpperCase() === challenge.code;

  const handleBackup = async () => {
    const info = await exportBackup();
    if (info) setBackupInfo(info);
  };

  const handleWipe = async () => {
    setWiping(true);
    setError("");
    try {
      const { data } = await axios.post(apiPath + apiAppResetWipe, { code: typed });
      setResult(data.data);
      notify("success", data.message);
      // Fresh start: back to activation screen with an empty Redux store
      setTimeout(() => {
        window.location.hash = "#/";
        window.location.reload();
      }, 4000);
    } catch (err) {
      // Server burns the code on any attempt — a new one is needed
      setChallenge(null);
      setError(errMsg(err, "Clean failed"));
    } finally {
      setWiping(false);
    }
  };

  const closable = !wiping && !result;

  return (
    <Dialog open={open} onClose={closable ? onClose : undefined} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: "#B91C1C", fontWeight: 700 }}>Clean All Data</DialogTitle>
      <DialogContent dividers>
        {result ? (
          <Box textAlign="center" py={2}>
            <CheckCircle sx={{ fontSize: 56, color: "#16A34A", mb: 1 }} />
            <Typography fontWeight={700} sx={{ color: "#201751" }}>
              All data deleted
            </Typography>
            <Typography variant="body2" sx={{ color: "#6B7280", mt: 1 }}>
              {result.registrations} registrations from {result.events} event(s), {result.backups} backup
              file(s) and {result.sdkFiles} SDK file(s) removed. Activation cleared.
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: "#9CA3AF", mt: 2 }}>
              Returning to the activation screen…
            </Typography>
          </Box>
        ) : loading ? (
          <Box textAlign="center" py={4}>
            <CircularProgress />
          </Box>
        ) : blocked ? (
          <Alert severity="error">{blocked}</Alert>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {challenge && (
              <>
                <Typography variant="body2" sx={{ color: "#374151", mb: 1 }}>
                  This permanently deletes <b>everything</b> on this computer:
                </Typography>
                <Box component="ul" sx={{ mt: 0, mb: 2, pl: 3, color: "#374151", fontSize: "0.875rem" }}>
                  <li>
                    <b>{challenge.registrations}</b> registrations from {challenge.events} event(s)
                  </li>
                  <li>Attendee types, badge templates, registration forms, sync history</li>
                  <li>
                    <b>{challenge.backups}</b> automatic database backup file(s)
                  </li>
                  <li>
                    <b>{challenge.sdkFiles}</b> SDK file(s)
                  </li>
                  <li>Activation — the app returns to the activation screen</li>
                </Box>

                {/* Step 1: backup */}
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#201751" }}>
                  Step 1 — Save a backup
                </Typography>
                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" mt={1}>
                  <Button
                    variant="outlined"
                    startIcon={exporting ? <CircularProgress size={16} /> : <Backup />}
                    onClick={handleBackup}
                    disabled={exporting}
                    sx={{ ...btnSx, color: "#201751", borderColor: "rgba(32,23,81,0.3)" }}
                  >
                    {backupInfo ? "Backup saved — save again" : "Download Backup"}
                  </Button>
                  <FormControlLabel
                    control={<Checkbox checked={skipBackup} onChange={(e) => setSkipBackup(e.target.checked)} />}
                    label={<Typography variant="body2">I have a backup / don't need one</Typography>}
                  />
                </Box>
                <LocalDriveWarning info={backupInfo} />

                {/* Step 2: type code */}
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ color: backupStepDone ? "#201751" : "#9CA3AF", mt: 3 }}
                >
                  Step 2 — Type{" "}
                  <Box
                    component="span"
                    sx={{
                      fontFamily: "monospace",
                      bgcolor: "rgba(185,28,28,0.08)",
                      color: "#B91C1C",
                      px: 1,
                      py: 0.25,
                      borderRadius: "6px",
                      userSelect: "all",
                    }}
                  >
                    {challenge.code}
                  </Box>{" "}
                  to confirm
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  autoComplete="off"
                  placeholder={challenge.code}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  disabled={!backupStepDone || expired}
                  sx={{ mt: 1, "& input": { fontFamily: "monospace" } }}
                />
                <Typography variant="caption" sx={{ color: expired ? "#B91C1C" : "#9CA3AF" }}>
                  {expired ? "Code expired." : `Code expires in ${secondsLeft}s`}
                </Typography>
              </>
            )}

            {(!challenge || expired) && (
              <Box mt={1}>
                <Button onClick={getChallenge} sx={{ textTransform: "none" }}>
                  Get a new code
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      {!result && (
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={wiping} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={wiping ? <CircularProgress size={16} color="inherit" /> : <DeleteForever />}
            onClick={handleWipe}
            disabled={!challenge || expired || !backupStepDone || !codeMatches || wiping}
            sx={btnSx}
          >
            Delete Everything
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

// ── Sections rendered at the bottom of Settings ────────────────────────────────
const DataManagement = ({ notify, refreshKey }) => {
  const [summary, setSummary] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [cleanOpen, setCleanOpen] = useState(false);
  const { exporting, lastExport, exportBackup } = useExport(notify);

  useEffect(() => {
    axios
      .get(apiPath + apiAppResetSummary)
      .then(({ data }) => setSummary(data.data))
      .catch(() => setSummary(null));
  }, [refreshKey]);

  const handleRestore = async () => {
    const ok = window.confirm(
      "Restore replaces ALL current data on this computer with the backup you choose, then restarts the app.\n\nContinue?",
    );
    if (!ok) return;
    setRestoring(true);
    try {
      const { data } = await axios.post(apiPath + apiAppResetRestore);
      notify("success", data.message);
      if (data.data?.canceled) setRestoring(false);
    } catch (err) {
      notify("error", errMsg(err, "Restore failed"));
      setRestoring(false);
    }
  };

  const pending = summary?.pendingPush ?? 0;

  return (
    <>
      {/* Backup & Restore */}
      <Box sx={cardSx}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#201751", mb: 0.5 }}>
          Backup &amp; Restore
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 2.5 }}>
          Export saves two files: a <b>.db</b> backup that can be restored into this app, and a <b>.csv</b> of
          all registrations for Excel or other software. Save to a USB or company drive — the files contain
          attendee personal data.
          {summary && ` Currently ${summary.registrations} registrations.`}
        </Typography>
        <Divider sx={{ mb: 2.5, borderColor: "rgba(32,23,81,0.08)" }} />
        <Box display="flex" gap={2} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={exporting ? <CircularProgress size={16} /> : <Backup />}
            onClick={exportBackup}
            disabled={exporting}
            sx={{ ...btnSx, color: "#201751", borderColor: "rgba(32,23,81,0.3)" }}
          >
            Export Backup
          </Button>
          <Button
            variant="outlined"
            startIcon={restoring ? <CircularProgress size={16} /> : <Restore />}
            onClick={handleRestore}
            disabled={restoring || pending > 0}
            title={pending > 0 ? "Push to Cloud first" : ""}
            sx={{ ...btnSx, color: "#201751", borderColor: "rgba(32,23,81,0.3)" }}
          >
            Restore from Backup
          </Button>
        </Box>
        <LocalDriveWarning info={lastExport} />
      </Box>

      {/* Danger Zone */}
      <Box sx={{ ...cardSx, border: "1px solid rgba(185,28,28,0.4)" }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#B91C1C", mb: 0.5 }}>
          Danger Zone — Clean All Data
        </Typography>
        <Typography variant="body2" sx={{ color: "#6B7280", mb: 2.5 }}>
          Use at the end of an event or before returning this laptop. Deletes all registrations for every
          event, automatic backups, SDK files and the activation. This cannot be undone.
        </Typography>
        <Divider sx={{ mb: 2.5, borderColor: "rgba(185,28,28,0.15)" }} />
        {pending > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {pending} local change{pending > 1 ? "s" : ""} not pushed to cloud. Push to Cloud first.
          </Alert>
        )}
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteForever />}
          onClick={() => setCleanOpen(true)}
          disabled={pending > 0}
          sx={btnSx}
        >
          Clean All Data
        </Button>
      </Box>

      <CleanDialog
        open={cleanOpen}
        onClose={() => setCleanOpen(false)}
        notify={notify}
        exportBackup={exportBackup}
        exporting={exporting}
      />
    </>
  );
};

export default DataManagement;
