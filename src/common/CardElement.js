import { Avatar, Box } from "@mui/material";
import QRCode from "react-qr-code";
import { calculateFontSize, toPx } from "./utils";

// Ported from vosmos-events-client (component/badge/CardElement.js), which mirrors the
// main admin's CardElement so the printed badge matches the admin's badge preview.

// antd QRCode: white box of `size` with 12px padding + 1px border, QR drawn inside
const QR_PADDING = 12;
const QR_BORDER = 1;

const CardElement = ({ el, userInfo, canvasWidth = 300 }) => {
  let value = "";

  if (el.type === "name")
    value = (userInfo?.firstName || "") + " " + (userInfo?.lastName || "");
  else if (el.type === "firstName") value = userInfo?.firstName;
  else if (el.type === "lastName") value = userInfo?.lastName;
  else if (el.type === "company") value = userInfo?.organization || "";
  else if (el.type === "designation") value = userInfo?.designation || "";
  else if (el.type === "industry")
    value = userInfo?.customfields?.industry || "";
  else if (el.type === "qrCode") value = userInfo?.qrCode || "";
  else if (el.type === "intent" && el.intentType === "text")
    value = el.intentOptions?.[userInfo?.customfields?.intent] || "";
  else value = el.label;

  /* ---------- NAME → single line shrinks font to fit, else wraps ---------- */
  if (el.type === "name" || el.type === "firstName" || el.type === "lastName") {
    const singleLine = el.singleLine ?? false;
    const maxTextWidth =
      toPx(el.style.width ?? canvasWidth, canvasWidth) -
      (Number(el.style.paddingLeft) || 0) -
      (Number(el.style.paddingRight) || 0);
    return (
      <div style={{ boxSizing: "border-box", ...el.style }}>
        <div
          style={{
            fontSize: singleLine
              ? calculateFontSize(value, maxTextWidth, el.style.fontSize)
              : el.style.fontSize,
            color: el.style.color,
            userSelect: "none",
            ...(singleLine
              ? {
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "inline-block",
                }
              : {
                  whiteSpace: "normal",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  display: "block",
                }),
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
  const intentImg = el.intentImageOptions?.[userInfo?.customfields?.intent];
  const size = toPx(el.style.width, canvasWidth);

  return (
    <div style={{ boxSizing: "border-box", ...el.style }}>
      {el.type === "img" ||
      el.type === "avatar" ||
      (el.type === "intent" && el.intentType === "image") ? (
        el.type === "avatar" ? (
          <Avatar
            variant={el.style.shape === "circle" ? "circular" : "rounded"}
            src={userInfo?.avatarUrl}
            sx={{ width: size, height: size }}
          />
        ) : (
          <>
            {intentImg && (
              <img
                src={intentImg}
                alt={el.type}
                style={{ width: "100%", height: el.style.height || "auto" }}
              />
            )}
            {el.style.url && (
              <img
                src={el.style.url}
                alt={el.type}
                style={{ width: "100%", height: el.style.height || "auto" }}
              />
            )}
          </>
        )
      ) : el.type === "qrCode" ? (
        <Box
          sx={{
            boxSizing: "border-box",
            width: size,
            height: size,
            p: `${QR_PADDING}px`,
            border: `${QR_BORDER}px solid rgba(5, 5, 5, 0.06)`,
            borderRadius: "8px",
            bgcolor: "white",
            display: "flex",
          }}
        >
          <QRCode
            // Same as cloud badges: uniqueUserId when the delegate has one; otherwise
            // the older JSON form (walk-ins have no uniqueUserId, maybe no cloudId yet)
            value={
              userInfo?.uniqueUserId ||
              JSON.stringify({ id: userInfo?.cloudId || userInfo?._id })
            }
            size={Math.max(0, size - (QR_PADDING + QR_BORDER) * 2)}
            bgColor="white"
          />
        </Box>
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
