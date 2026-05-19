import { ImageResponse } from "next/og";

export const runtime = "edge";

const VALID_SIZES = [192, 512] as const;
type ValidSize = (typeof VALID_SIZES)[number];

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: sizeParam } = await params;
  const size = parseInt(sizeParam, 10) as ValidSize;

  if (!VALID_SIZES.includes(size as ValidSize)) {
    return new Response("Not found", { status: 404 });
  }

  const circleSize = Math.round(size * 0.55);
  const fontSize = Math.round(size * 0.32);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "#0B0B0B",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: circleSize,
            height: circleSize,
            border: `${Math.round(size * 0.025)}px solid #C9A84C`,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#C9A84C",
            fontSize: fontSize,
            fontStyle: "italic",
            fontFamily: "Georgia, serif",
          }}
        >
          S
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}
