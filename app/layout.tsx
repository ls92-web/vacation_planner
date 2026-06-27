import type { Metadata } from "next";
import { Bricolage_Grotesque, Lora, Plus_Jakarta_Sans, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${bricolage.variable} ${lora.variable} ${jakarta.variable} ${splineMono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
