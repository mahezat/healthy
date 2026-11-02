import { ImageResponse } from "next/og";

/** Plain app icon in the Stitch colors: the wordmark's first letter, lime on deep indigo. */
export function appIcon(px: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0050", color: "#e2ff4f", fontSize: px * 0.62, fontWeight: 700 }}>
        s
      </div>
    ),
    { width: px, height: px },
  );
}
