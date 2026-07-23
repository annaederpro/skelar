import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2e6e7a",
        }}
      >
        <svg width="20" height="24" viewBox="0 0 100 120" fill="none">
          <circle cx="46" cy="46" r="29" stroke="#f1f6f4" strokeWidth="14" />
          <g stroke="#df8464" strokeWidth="13" strokeLinecap="round">
            <path d="M60 60 L72 74" />
            <path d="M72 74 L85 70" />
            <path d="M72 74 L79 90" />
          </g>
          <circle cx="70" cy="24" r="6" fill="#e7d9bc" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
