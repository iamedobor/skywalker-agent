import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SkyWalker — AI Browser Agent",
  description: "The open-source Action-Model that turns natural language into browser actions.",
  keywords: ["AI agent", "browser automation", "Playwright", "LLM", "open source"],
  authors: [{ name: "SkyWalker Contributors" }],
  openGraph: {
    title: "SkyWalker — AI Browser Agent",
    description: "The Browser Agent with Eyes. Turn any natural language goal into automated browser actions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
