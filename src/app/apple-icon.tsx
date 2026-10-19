import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#a9bfa5,#8ea98b)" }}>
        <div style={{ width: 110, height: 110, borderRadius: 999, background: "radial-gradient(circle at 40% 38%, #ffc48f, #f6935a 60%, #e5643f)" }} />
      </div>
    ),
    size,
  );
}
