import { Box, Avatar } from "@mui/material";
import QRCode from "react-qr-code";
import { calculateFontSize } from "./utils";

const CardElement = ({ el, userInfo, canvasWidth = 300 }) => {
  let value = "";

  if (el.type === "name")
    value = (userInfo?.firstName || "") + " " + (userInfo?.lastName || "");
  else if (el.type === "firstName") value = userInfo?.firstName;
  else if (el.type === "lastName") value = userInfo?.lastName;
  else if (el.type === "company") value = userInfo?.organization || "";
  else if (el.type === "designation") value = userInfo?.designation || "";
  else if (el.type === "qrCode") value = userInfo?.qrCode || "";
  else value = el.label;

  /* ---------- NAME (full width, centered) ---------- */
  if (el.type === "name" || el.type === "firstName" || el.type === "lastName") {
    return (
      <div style={el.style}>
        <div
          style={{
            fontSize: calculateFontSize(
              value,
              canvasWidth - 20,
              el.style.fontSize,
            ),
            color: el.style.color,
            userSelect: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "inline-block",
            maxWidth: "100%",
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
      </div>
    );
  }

  /* ---------- OTHER ELEMENTS ---------- */
  return (
    <div style={el.style}>
      {el.type === "img" || el.type === "avatar" ? (
        el.type === "avatar" ? (
          <Avatar
            variant={el.style.shape === "circle" ? "circular" : "square"}
            src={userInfo?.avatarUrl}
            sx={{
              width: el.style.width,
              height: el.style.height || el.style.width,
            }}
          />
        ) : (
          <img
            src={el.style.url}
            alt={el.type}
            style={{
              width: el.style.width,
              height: el.style.height || "auto",
            }}
          />
        )
      ) : el.type === "qrCode" ? (
        <QRCode
          value={JSON.stringify({
            id: userInfo?.cloudId || userInfo?._id,
          })}
          size={el.style.width}
          bgColor="white"
        />
      ) : el.type !== "row" ? (
        <div
          style={{
            fontSize: el.style.fontSize,
            color: el.style.color,
            userSelect: "none",
            display: "-webkit-box",
            WebkitLineClamp: el.style.maxLines || 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
      ) : null}
    </div>
  );
};

export default CardElement;
