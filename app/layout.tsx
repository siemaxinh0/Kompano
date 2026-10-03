import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Helpovski — pomoc na wyciągnięcie ręki",
  description:
    "Łączymy osoby ze szczególnymi potrzebami i seniorów z wolontariuszami.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className={`${geistSans.variable} h-full`}>
      <body className="min-h-dvh bg-neutral-200 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
