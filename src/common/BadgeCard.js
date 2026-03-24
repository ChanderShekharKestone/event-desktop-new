import { Box } from "@mui/material";
import CardElement from "./CardElement";

const BadgeCard = ({ badge, userInfo, cardRef }) => {
  if (!badge) return null;
  return (
    <Box
      ref={cardRef}
      className="print-card"
      sx={{
        width: Number(badge.width),
        height: Number(badge.height),
        position: "relative",
        overflow: "hidden",
        backgroundImage: `url(${badge.bgImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        fontFamily: `"${badge.fontFamily || "Arial"}", sans-serif`,
        left: "50%",
        transform: "translate(-50%, 0%)",
      }}
    >
      {badge.elements?.map((el) => (
        <CardElement
          key={el.id}
          el={el}
          userInfo={userInfo}
          canvasWidth={Number(badge.width)}
        />
      ))}
    </Box>
  );
};

export default BadgeCard;
