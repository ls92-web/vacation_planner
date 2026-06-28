import type { Metadata } from "next";
import { DM_Serif_Display, Outfit, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Branding (wordmark + hero serif) — DM Serif Display.
const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});

// UI typeface (body + display headings) — Outfit.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-spline",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Itinera — Every journey, perfectly planned.",
  description:
    "Itinera is an AI-powered travel planning platform: plan multi-destination trips, manage hotels, discover attractions, optimize routes, build day-by-day schedules, and export beautiful itineraries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${dmSerif.variable} ${splineMono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
