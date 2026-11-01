import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Dancing_Script,
  Geist_Mono,
  Nunito_Sans,
} from "next/font/google";

import { AppToaster } from "@/components/feedback";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Virtuoso-like stack — Cormorant Garamond (display) + Nunito Sans (Avenir-like UI).
 * Puriva wordmark stays Dancing Script.
 */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
  display: "swap",
});

/** Puriva agent wordmark — flowing script closer to Myra. */
const purivaMark = Dancing_Script({
  variable: "--font-puriva",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const studioFaviconPath = "/images/pl_favicon.png";

export const metadata: Metadata = {
  title: {
    default: "PureLuxe Studio",
    template: "%s · PureLuxe Studio",
  },
  description: "Internal team platform for PureLuxe travel planning and operations.",
  icons: {
    icon: [{ url: studioFaviconPath, type: "image/png" }],
    apple: studioFaviconPath,
    shortcut: studioFaviconPath,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /** Shrink the layout when the mobile keyboard opens so the composer stays visible. */
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunitoSans.variable} ${cormorant.variable} ${geistMono.variable} ${purivaMark.variable} h-dvh overflow-hidden antialiased`}
    >
      <body className="h-dvh overflow-hidden font-sans">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
