import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

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
  title: "Wanderfold — AI Vacation Planner",
  description:
    "One messy idea of a trip, one finished plan. Family-oriented, AI-assisted multi-destination trip planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${jakarta.variable} ${splineMono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
