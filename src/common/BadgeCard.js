import { Box } from "@mui/material";
import CardElement from "./CardElement";

const alignmentStyles = {
  left:   { marginLeft: 0, marginRight: "auto" },
  center: { marginLeft: "auto", marginRight: "auto" },
  right:  { marginLeft: "auto", marginRight: 0 },
};

const BadgeCard = ({ badge, userInfo, cardRef }) => {
  if (!badge) return null;
  const align = alignmentStyles[badge.alignment] ?? alignmentStyles.center;

  return (
    <Box
      sx={{
        position: "relative",
        width: Number(badge.width),
        height: Number(badge.height),
        ...align,
        // remove any inherited positional offsets
        left: "unset",
        transform: "none",
      }}
    >
      <Box
        className="print-card-bg"
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      />

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
          zIndex: 1,
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
    </Box>
  );
};

export default BadgeCard;
