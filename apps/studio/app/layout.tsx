import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";

import { AppToaster } from "@/components/feedback";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Interface font across the app. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const studioLogoPath = "/images/pureluxe-studio-logo.svg";

export const metadata: Metadata = {
  title: {
    default: "PureLuxe Studio",
    template: "%s · PureLuxe Studio",
  },
  description: "Internal team platform for PureLuxe travel planning and operations.",
  icons: {
    icon: [{ url: studioLogoPath, type: "image/png" }],
    apple: studioLogoPath,
    shortcut: studioLogoPath,
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
      className={`${inter.variable} ${geistMono.variable} ${fraunces.variable} h-dvh overflow-hidden antialiased`}
    >
      <body className="h-dvh overflow-hidden font-sans">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
