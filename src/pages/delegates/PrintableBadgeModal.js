import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Button,
  Box,
  Typography,
  IconButton,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PrintIcon from "@mui/icons-material/Print";
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
    documentTitle:
      [userInfo?.firstName, userInfo?.lastName].filter(Boolean).join(" ") ||
      "badge",
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

  const name =
    [userInfo?.firstName, userInfo?.lastName].filter(Boolean).join(" ") || "—";

  return (
    <Dialog
      open={Boolean(userInfo)}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
    >
      <DialogTitle sx={{ px: 3, pt: 2.5, pb: 0 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography fontWeight={700} fontSize={17} color="#111827">
              Print Badge
            </Typography>
            {/* <Typography fontSize={13} color="#6B7280" mt={0.25}>{name}</Typography> */}
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: "#9CA3AF" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2, pb: 3 }}>
        <Box display="flex" gap={2.5} mt={1}>
          {/* Left — template picker */}
          <Box sx={{ width: 160, flexShrink: 0 }}>
            <Typography
              fontSize={11}
              fontWeight={700}
              color="#9CA3AF"
              textTransform="uppercase"
              letterSpacing="0.06em"
              mb={1}
            >
              Template
            </Typography>
            <Box
              display="flex"
              flexDirection="column"
              gap={1}
              sx={{ maxHeight: 460, overflowY: "auto", pr: 0.5 }}
            >
              {badgeData?.map((item) => {
                const isSelected =
                  (item._id || item.id) === (badge?._id || badge?.id);
                return (
                  <Box
                    key={item._id || item.id}
                    onClick={() => setBadge(item)}
                    sx={{
                      px: 1.5,
                      py: 1.25,
                      borderRadius: "10px",
                      border: isSelected
                        ? "2px solid #201751"
                        : "1.5px solid rgba(0,0,0,0.08)",
                      bgcolor: isSelected ? "rgba(32,23,81,0.06)" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      "&:hover": {
                        borderColor: "#201751",
                        bgcolor: "rgba(32,23,81,0.04)",
                      },
                    }}
                  >
                    <Typography
                      fontSize={13}
                      fontWeight={isSelected ? 700 : 500}
                      color={isSelected ? "#201751" : "#374151"}
                      sx={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        overflow: "hidden",
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {item.name}
                    </Typography>
                    {item.type && (
                      <Chip
                        label={item.type}
                        size="small"
                        sx={{
                          mt: 0.75,
                          height: 18,
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          bgcolor: isSelected
                            ? "rgba(32,23,81,0.12)"
                            : "rgba(0,0,0,0.05)",
                          color: isSelected ? "#201751" : "#6B7280",
                          textTransform: "capitalize",
                        }}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Right — preview + print */}
          <Box
            flex={1}
            display="flex"
            flexDirection="column"
            alignItems="center"
          >
            <Typography
              fontSize={11}
              fontWeight={700}
              color="#9CA3AF"
              textTransform="uppercase"
              letterSpacing="0.06em"
              mb={1}
              alignSelf="flex-start"
            >
              Preview
            </Typography>
            <Box
              sx={{
                // flex: 1,
                width: "100%",
                // display: "flex",
                // alignItems: "center",
                // justifyContent: "center",
                bgcolor: "rgba(0,0,0,0.02)",
                border: "1.5px dashed rgba(0,0,0,0.1)",
                borderRadius: "12px",
                p: 1,
                minHeight: 320,
              }}
            >
              {badge ? (
                <BadgeCard
                  badge={badge}
                  userInfo={userInfo}
                  cardRef={cardRef}
                />
              ) : (
                <Typography fontSize={13} color="#9CA3AF">
                  Select a template
                </Typography>
              )}
            </Box>

            <Button
              variant="contained"
              startIcon={<PrintIcon />}
              onClick={handlePrintClick}
              disabled={!badge}
              sx={{
                mt: 2,
                px: 4,
                py: 1,
                borderRadius: "10px",
                fontWeight: 700,
                textTransform: "none",
                fontSize: 14,
                bgcolor: "#201751",
                "&:hover": { bgcolor: "#170f3d" },
              }}
            >
              Print Badge
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PrintableBadgeModal;
