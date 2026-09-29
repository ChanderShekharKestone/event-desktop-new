import { Box, Button, Chip, Tooltip, Typography } from "@mui/material";

// Role label — same as the cloud giveaway page (vosmos-events-client giveaway/columns.js)
const ROLES = { vos78: "Delegate", vos58: "Speaker", vos68: "Exhibitor", vos82: "Moderator" };
const TYPES = { mob001: "Sponsor", mob011: "Partner" };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const getRoleName = (row) =>
  TYPES[row?.type] ||
  (row?.type && row.type !== "attendee" ? cap(row.type) : null) ||
  ROLES[row?.roleId] ||
  "Other";

/**
 * One button per giveaway:
 *  - red outlined  = already given to this delegate (click to revert)
 *  - disabled      = out of stock
 *  - blue outlined = in stock (click to assign)
 */
const GiveawayButtons = ({ row, giveaways, busy, onAssign, onRevert }) => {
  if (!giveaways?.length)
    return <Typography sx={{ fontSize: 12, color: "#6b7280" }}>No giveaways found.</Typography>;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, py: 1 }}>
      {giveaways.map((g) => {
        const assigned = row.giveawayIds?.includes(g._id);
        const shortTitle = g.title?.length > 14 ? `${g.title.substring(0, 14)}…` : g.title;
        const btnSx = { textTransform: "none", fontSize: 12, py: 0.25, px: 1, minWidth: 0 };

        if (assigned) {
          return (
            <Tooltip key={g._id} title={`${g.title} — click to revert`}>
              <span>
                <Button
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={btnSx}
                  disabled={busy}
                  onClick={() => onRevert(row, g)}
                >
                  ✓ {shortTitle}
                </Button>
              </span>
            </Tooltip>
          );
        }
        if (g.remainingQuantity <= 0) {
          return (
            <Tooltip key={g._id} title={`${g.title} — out of stock`}>
              <span>
                <Button size="small" variant="outlined" sx={btnSx} disabled>
                  {shortTitle}
                </Button>
              </span>
            </Tooltip>
          );
        }
        return (
          <Tooltip key={g._id} title={`${g.title} — click to assign`}>
            <span>
              <Button
                size="small"
                variant="outlined"
                sx={btnSx}
                disabled={busy}
                onClick={() => onAssign(row, g)}
              >
                {shortTitle}
              </Button>
            </span>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export const getColumns = ({ compact = false, ...props }) => [
  {
    field: "sortOrder",
    headerName: "S. No.",
    width: 70,
    sortable: false,
  },
  {
    field: "firstName",
    headerName: "User details",
    flex: 1.2,
    minWidth: 220,
    sortable: false,
    // Compact: Role and Giveaways are shown inside this cell as a card
    renderCell: ({ row }) => (
      <Box sx={{ py: 1, lineHeight: 1.5, minWidth: 0, width: "100%" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#111827" }} noWrap>
          {`${row.firstName || ""} ${row.lastName || ""}`.trim() || "—"}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "#6b7280" }} noWrap>
          {row.email || "—"}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "#6b7280" }} noWrap>
          {[row.organization, row.designation].filter(Boolean).join(" · ") || "—"}
        </Typography>
        {compact && (
          <>
            <Box sx={{ mt: 0.75 }}>
              <Chip
                label={getRoleName(row)}
                size="small"
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#201751",
                  background: "rgba(32,23,81,0.08)",
                }}
              />
            </Box>
            <GiveawayButtons row={row} {...props} />
          </>
        )}
      </Box>
    ),
  },
  {
    field: "roleId",
    headerName: "Role",
    width: 110,
    sortable: false,
    renderCell: ({ row }) => <Typography sx={{ fontSize: 13 }}>{getRoleName(row)}</Typography>,
  },
  {
    field: "giveaways",
    headerName: "Giveaways",
    flex: 2,
    minWidth: 280,
    sortable: false,
    renderCell: ({ row }) => <GiveawayButtons row={row} {...props} />,
  },
];
