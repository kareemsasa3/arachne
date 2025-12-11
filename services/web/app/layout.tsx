import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SpiderWebBackground from "@/components/SpiderWebBackground";
import ChatWidgetWrapper from "@/components/ChatWidgetWrapper";
import SiteHeader from "@/components/SiteHeader";
import { Oxanium } from "next/font/google";

const oxanium = Oxanium({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-oxanium",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arachne",
  description: "Launch scrapes with Arachne, summarize results, and chat with an assistant that speaks web data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={oxanium.variable}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased relative bg-gray-900 text-gray-100`}
      >
        <SpiderWebBackground />
        <div className="relative z-10 min-h-screen">
          <SiteHeader />
          {children}
        </div>
        <ChatWidgetWrapper />
      </body>
    </html>
  );
}
