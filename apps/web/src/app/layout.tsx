import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "CryptoSniper V2 - Enterprise-grade Trading & Alerts",
  description: "Advanced crypto trading strategy screener and price alerts platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${outfit.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans bg-zinc-950 text-zinc-50" suppressHydrationWarning>
        <div className="glow-bg" />
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
