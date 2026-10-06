import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { AppProviders } from "@/components/AppProviders";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "CryptoSniper V2 - 加密貨幣多時框策略篩選、量化回測與即時到價通知平台 | Crypto Screener & Backtester",
  description: "專為加密貨幣交易者打造的量化決策平台。支援多時框技術指標篩選（RSI、MACD、EMA）、歷史行情策略回測（勝率/MDD/淨值曲線分析）以及毫秒級 Telegram / Discord 即時到價監控通知。",
  keywords: [
    "加密貨幣回測",
    "量化交易",
    "策略回測",
    "Crypto Backtester",
    "比特幣回測",
    "加密貨幣篩選器",
    "到價通知",
    "Telegram 報價機器人",
    "Trading Strategy Screener",
    "Max Drawdown",
    "技術指標篩選",
  ],
  openGraph: {
    title: "CryptoSniper V2 - 多時框策略篩選與量化回測系統",
    description: "多時框技術指標篩選、歷史行情策略回測與多管道即時到價通知。",
    url: "https://crypto-sniper.minglin.net",
    siteName: "CryptoSniper V2",
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CryptoSniper V2 - 多時框策略篩選與量化回測系統",
    description: "多時框技術指標篩選、歷史行情策略回測與多管道即時到價通知。",
  },
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
