import type { Metadata, Viewport } from "next";
import { Comfortaa, Nunito } from "next/font/google";
import { APP_NAME } from "@/lib/client/format";
import "./globals.css";

const comfortaa = Comfortaa({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-comfortaa" });
const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-nunito" });

// Only the icons the screens use (keeps the icon font small). Names must stay in alphabetical order.
const ICONS = [
  "arrow_back", "arrow_forward", "arrow_upward", "biotech", "chevron_right", "close", "delete", "done",
  "expand_more", "flash_off", "flash_on", "help_outline", "history", "lock", "photo_camera", "search",
  "share", "spa", "sync", "verified_user", "videocam",
].join(",");

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Health score and boycott check for anything you scan.",
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0c0050",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${comfortaa.variable} ${nunito.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0..1,0&icon_names=${ICONS}&display=block`}
        />
      </head>
      <body className="min-h-screen bg-surface font-sans text-on-surface antialiased selection:bg-brand-lavender selection:text-brand-dark">
        {children}
      </body>
    </html>
  );
}
