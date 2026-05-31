import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://markets-lens.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "MarketLens — Professional Macro Dashboard",
    template: "%s | MarketLens",
  },
  description:
    "Institutional-grade macro dashboard covering US equities, fixed income, commodities, and Latin American markets. Built for ETF coverage of AFPs, insurance companies, family offices, and private banks.",
  keywords: [
    "macro dashboard",
    "ETF",
    "fixed income",
    "yield curve",
    "Colombia",
    "emerging markets",
    "BlackRock",
    "institutional investors",
  ],
  authors: [{ name: "MarketLens" }],
  // Private institutional tool — keep it off search engines
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "MarketLens",
    title: "MarketLens — Professional Macro Dashboard",
    description:
      "Institutional-grade macro dashboard: US equities, fixed income, yield curve, commodities, and Latin American markets.",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "MarketLens",
    description: "Professional macro dashboard for institutional ETF coverage.",
  },
  // Canonical URL
  alternates: { canonical: APP_URL },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a", // slate-900 — matches the dark background
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
