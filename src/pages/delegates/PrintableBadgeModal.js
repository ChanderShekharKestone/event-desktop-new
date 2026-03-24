import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  Grid,
  Button,
  Box,
  Typography,
  IconButton,
} from "@mui/material";
import BadgeIcon from "@mui/icons-material/Badge";
import CloseIcon from "@mui/icons-material/Close";
import { useReactToPrint } from "react-to-print";
import axios from "axios";
import { apiPath, apiGetRegistrations } from "../../apiPath";
import useBadgePrint from "../../hooks/useBadgePrint";
import BadgeCard from "../../common/BadgeCard";

const PrintableBadgeModal = ({ userInfo, onClose, badgeData }) => {
  const [badge, setBadge] = useState(null);
  const cardRef = useRef();
  const { pageStyle } = useBadgePrint(badge);

  useEffect(() => {
    if (badgeData?.length > 0) {
      const matched = badgeData.find(
        (item) => item.type?.toLowerCase() === userInfo?.type?.toLowerCase(),
      );
      setBadge(matched || badgeData[0]);
    }
  }, [badgeData, userInfo?.type]);

  const handlePrint = useReactToPrint({
    contentRef: cardRef,
    documentTitle: userInfo?.email || "badge",
    pageStyle,
  });

  const handlePrintClick = async () => {
    try {
      await axios.put(`${apiPath}${apiGetRegistrations}/${userInfo._id}`, {
        isPrintClicked: true,
      });
    } catch (err) {
      console.error("Failed to mark print clicked:", err.message);
    }
    handlePrint();
  };

  return (
    <Dialog open={Boolean(userInfo)} onClose={onClose} maxWidth="md" fullWidth>
      <IconButton
        onClick={onClose}
        sx={{ position: "absolute", top: 8, right: 8, zIndex: 10, color: "grey.600" }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent>
        <Grid container spacing={2}>
          {/* Badge template list */}
          <Grid size={{ xs: 12, md: 3 }} sx={{ maxHeight: 550, overflowY: "auto" }}>
            {badgeData?.map((item) => (
              <Button
                key={item._id || item.id}
                fullWidth
                variant={
                  (item._id || item.id) === (badge?._id || badge?.id)
                    ? "contained"
                    : "outlined"
                }
                onClick={() => setBadge(item)}
                sx={{ mb: 1, minHeight: 80, flexDirection: "column", gap: 0.5 }}
              >
                <BadgeIcon fontSize="large" />
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: "center",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {item.name}
                </Typography>
              </Button>
            ))}
          </Grid>

          {/* Badge preview */}
          <Grid size={{ xs: 12, md: 9 }}>
            {badge && (
              <>
                <BadgeCard badge={badge} userInfo={userInfo} cardRef={cardRef} />
                <Box textAlign="center" mt={2}>
                  <Button variant="contained" onClick={handlePrintClick}>
                    Print
                  </Button>
                </Box>
              </>
            )}
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

export default PrintableBadgeModal;
