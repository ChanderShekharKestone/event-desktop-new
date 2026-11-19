import { Dialog as MuiDialog, IconButton, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// Ways of closing that are NOT a deliberate click on the popup's own button
const IGNORED = ["backdropClick", "escapeKeyDown"];

/**
 * MUI Dialog for every popup in the app:
 *  - a close (×) button in the top-right corner whenever the popup can be closed
 *    (onClose given) — popups pass onClose={busy ? undefined : …} to hide it while saving;
 *  - only closes from its own buttons (× / Cancel / Done …): a click outside or the Esc key
 *    does nothing, so a half-filled form or a scan prompt can't be lost by a stray tap.
 * Same props as MUI's Dialog, plus hideCloseButton for a popup that draws its own ×.
 * Import this instead of `Dialog` from @mui/material.
 */
const Dialog = ({ onClose, hideCloseButton = false, sx, children, ...props }) => {
  const showClose = Boolean(onClose) && !hideCloseButton;
  return (
    <MuiDialog
      {...props}
      onClose={onClose && ((event, reason) => !IGNORED.includes(reason) && onClose(event, reason))}
      // Keep the title clear of the × button
      sx={[showClose && { "& .MuiDialogTitle-root": { pr: 6 } }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {showClose && (
        <Tooltip title="Close">
          <IconButton
            aria-label="Close"
            onClick={(event) => onClose(event, "closeButton")}
            size="small"
            sx={{ position: "absolute", top: 10, right: 10, zIndex: 1, color: "#6b7280" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {children}
    </MuiDialog>
  );
};

export default Dialog;
