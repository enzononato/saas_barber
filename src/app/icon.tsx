import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0B0B0B",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            border: "1.5px solid #C9A84C",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#C9A84C",
            fontSize: 13,
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
          }}
        >
          S
        </div>
      </div>
    ),
    { ...size },
  );
}
