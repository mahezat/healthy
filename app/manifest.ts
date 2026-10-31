import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/client/format";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Health score and boycott check for anything you scan.",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0050",
    theme_color: "#0c0050",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
