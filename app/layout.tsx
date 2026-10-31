import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Healthy",
  description: "Health score and boycott check for anything you scan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
