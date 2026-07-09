"use client";

import React from "react";
import Link from "next/link";
import { useApp } from "@/components/AppProviders";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Bell,
  Settings,
  Shield,
  ArrowRight,
  Target,
  CheckCircle,
  Zap,
  Lock,
  X,
  Sparkles,
} from "lucide-react";

const pageTranslations = {
  "zh-TW": {
    brandName: "CryptoSniper V2",
    tagline: "多時框加密貨幣策略篩選與即時到價通知平台",
    description: "專為專業交易者設計的實時市場監控與到價通知系統。支援多種技術指標（RSI、MACD、MA）、多時間週期篩選，並能以毫秒級速度透過 Telegram、Discord 及瀏覽器推送通知，讓您隨時掌握行情、精準狙擊交易機會。",
    getStarted: "進入系統",
    register: "註冊帳號",
    featuresTitle: "核心功能優勢",
    featuresSub: "為您提供最精準、快速的加密貨幣監控與通知服務",
    feature1Title: "實時策略篩選器",
    feature1Desc: "在多個時間維度（5m 至 1d）上同時監控多個交易對的 RSI、MACD、KDJ 等多種技術指標，一目了然。",
    feature2Title: "多管道即時通知",
    feature2Desc: "一旦價格或指標觸及設定條件，系統會在毫秒內透過 Telegram Bot、Discord Webhook 及網頁 Push 進行通知。",
    feature3Title: "靈活的條件配置",
    feature3Desc: "支援設定價格大於/小於、指標黃金交叉、死亡交叉等多樣化策略，完美契合您的交易邏輯。",
    feature4Title: "高可靠即時監控架構",
    feature4Desc: "基於 Bun、NestJS、Redis 隊列及 PostgreSQL 建構，保證在極端行情下也能穩定運行、絕不漏報。",
    howItWorksTitle: "如何開始使用？",
    step1Title: "1. 註冊與連結",
    step1Desc: "註冊您的 CryptoSniper 帳戶，並在設定中一鍵連結 Telegram 機器人或 Discord Webhook。",
    step2Title: "2. 配置監控條件",
    step2Desc: "選擇您感興趣的交易對，設定目標價格或指標條件（例如 BTC 小於等於 95000 或 RSI 低於 30）。",
    step3Title: "3. 接收即時推送",
    step3Desc: "系統將持續全天候監控市場，觸發條件時立即發送通知，助您在最佳時機完成交易。",
    footerDesc: "CryptoSniper V2 致力於為加密貨幣交易者提供最專業、即時的行情篩選與多管道到價通知服務，助您在瞬息萬變的市場中把握良機。",
    privacyPolicy: "隱私權政策",
    termsOfService: "服務條款",
    contactSupport: "聯絡我們 / 技術支援",
    contactText: "如有任何問題或需求，請聯絡 minglin.net@gmail.com",

    // Live preview translation keys
    demoTitle: "即時多時框策略篩選器",
    demoSubtitle: "免登入即可觀察實時數據動態篩選，切換預設策略預覽結果",
    strategyTab1: "EMA 9 > EMA 21 黃金交叉 (15m)",
    strategyTab2: "SMA 20 > SMA 50 多頭排列 (4h)",
    strategyTab3: "EMA 50 < EMA 200 空頭排列 (1d)",
    tableSymbol: "交易對",
    tablePrice: "最新價格",
    tableVolume: "24h 成交量",
    tableAction: "操作",
    actionNotify: "到價通知",
    actionWatch: "加入追蹤",
    loadingText: "正在獲取實時篩選數據...",
    noResults: "目前市場暫無符合該篩選條件的交易對",
    customizeBtn: "自訂篩選指標",
    unlockTitle: "解鎖完整功能",
    unlockDesc: "加入 CryptoSniper 即可解鎖完整功能！註冊帳戶後，您將可以：",
    unlockPoint1: "配置更複雜的多時間週期與自訂技術指標組合篩選（如 RSI 超賣、MACD 交叉、多重均線組合）。",
    unlockPoint2: "一鍵串接 Telegram Bot 或 Discord Webhook，當市場滿足條件時，在毫秒內自動傳送到價通知。",
    unlockPoint3: "管理個人專屬策略分類與自選追蹤清單，由系統 24/7 全天候在雲端自動監控運行。",
    loginNow: "立即登入",
    registerFree: "免費註冊",
    close: "關閉",
  },
  "en-US": {
    brandName: "CryptoSniper V2",
    tagline: "Multi-Timeframe Crypto Strategy Screener & Alerts Platform",
    description: "A real-time market monitoring and price notification system tailored for professional traders. Monitor custom technical indicators (RSI, MACD, MA) across multiple timeframes, and receive millisecond-level notifications via Telegram, Discord, and browser push notifications to seize every market opportunity.",
    getStarted: "Go to Console",
    register: "Register Account",
    featuresTitle: "Core Features",
    featuresSub: "Providing you with the most accurate and real-time cryptocurrency monitoring and alerts.",
    feature1Title: "Real-Time Strategy Screener",
    feature1Desc: "Simultaneously monitor multiple trading pairs across various timeframes (5m to 1d) with technical indicators like RSI, MACD, and KDJ.",
    feature2Title: "Instant Multi-Channel Alerts",
    feature2Desc: "Once prices or indicators trigger your custom criteria, receive notifications in milliseconds via Telegram, Discord Webhook, and Web Push.",
    feature3Title: "Flexible Condition Settings",
    feature3Desc: "Configure price thresholds, indicator crossovers, or complex strategies matching your custom trading rules.",
    feature4Title: "High-Availability Alert Architecture",
    feature4Desc: "Powered by Bun, NestJS, Redis Queues, and PostgreSQL to guarantee high availability and zero missed alerts, even during extreme market volatility.",
    howItWorksTitle: "How It Works",
    step1Title: "1. Register & Link",
    step1Desc: "Create your CryptoSniper account and link your Telegram bot or Discord webhook with one click in the dashboard.",
    step2Title: "2. Configure Alerts",
    step2Desc: "Choose your trading pairs and set price triggers or indicator conditions (e.g., BTC <= 95000 or RSI < 30).",
    step3Title: "3. Receive Real-Time Alerts",
    step3Desc: "Our system monitors the markets 24/7 and instantly fires alerts to your channels so you can trade on time.",
    footerDesc: "CryptoSniper V2 is dedicated to providing professional, real-time market screening and multi-channel price alerts to help you capture every opportunity in the volatile crypto markets.",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    contactSupport: "Contact / Support",
    contactText: "For any questions or inquiries, contact minglin.net@gmail.com",

    // Live preview translation keys
    demoTitle: "Live Multi-Timeframe Strategy Screener",
    demoSubtitle: "Experience real-time market strategy screening below without logging in.",
    strategyTab1: "EMA 9 > EMA 21 Golden Cross (15m)",
    strategyTab2: "SMA 20 > SMA 50 Bullish Trend (4h)",
    strategyTab3: "EMA 50 < EMA 200 Bearish Trend (1d)",
    tableSymbol: "Symbol",
    tablePrice: "Last Price",
    tableVolume: "24h Volume",
    tableAction: "Action",
    actionNotify: "Alert Me",
    actionWatch: "Watch",
    loadingText: "Fetching real-time screening data...",
    noResults: "No trading pairs currently match this filter",
    customizeBtn: "Customize Indicators",
    unlockTitle: "Unlock Full Features",
    unlockDesc: "Join CryptoSniper to unlock all capabilities! Once registered, you will be able to:",
    unlockPoint1: "Configure advanced multi-timeframe indicator filters (e.g. RSI oversold, MACD crossovers, multi-MA combinations).",
    unlockPoint2: "Link your Telegram Bot or Discord Webhook to receive instant alerts within milliseconds.",
    unlockPoint3: "Manage your custom strategies and watchlists under continuous 24/7 scanning.",
    loginNow: "Login Now",
    registerFree: "Register Free",
    close: "Close",
  },
};

export default function Home() {
  const { locale } = useApp();
  const t = pageTranslations[locale] || pageTranslations["zh-TW"];

  // Stateful interactive demo states
  const [selectedStrat, setSelectedStrat] = React.useState("ema9_21_15m");
  const [demoResults, setDemoResults] = React.useState<any[]>([]);
  const [demoLoading, setDemoLoading] = React.useState(false);
  const [demoError, setDemoError] = React.useState<string | null>(null);
  const [isWarmingUp, setIsWarmingUp] = React.useState(false);
  const [isUnlockOpen, setIsUnlockOpen] = React.useState(false);

  const strategyPayloads = React.useMemo(() => ({
    ema9_21_15m: {
      timeframes: [
        {
          interval: "15m",
          conditions: [
            { ma1Type: "EMA", ma1Period: 9, operator: "gt", ma2Type: "EMA", ma2Period: 21 },
          ],
        },
      ],
    },
    sma20_50_4h: {
      timeframes: [
        {
          interval: "4h",
          conditions: [
            { ma1Type: "SMA", ma1Period: 20, operator: "gt", ma2Type: "SMA", ma2Period: 50 },
          ],
        },
      ],
    },
    ema50_200_1d: {
      timeframes: [
        {
          interval: "1d",
          conditions: [
            { ma1Type: "EMA", ma1Period: 50, operator: "lt", ma2Type: "EMA", ma2Period: 200 },
          ],
        },
      ],
    },
  }), []);

  React.useEffect(() => {
    async function runScreen() {
      setDemoLoading(true);
      setDemoError(null);
      setIsWarmingUp(false);
      try {
        const payload = strategyPayloads[selectedStrat as keyof typeof strategyPayloads];
        const res = await fetch("/api/market/screener", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 503) {
          setIsWarmingUp(true);
          setDemoResults([]);
          return;
        }

        if (res.status === 429) {
          setDemoError(locale === "zh-TW" ? "請求過於頻繁，請稍候再試" : "Too many requests. Please try again later.");
          setDemoResults([]);
          return;
        }

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || "Failed to fetch");
        }

        const resData = await res.json();
        setDemoResults(resData.data || []);
      } catch (err: any) {
        const errorMsg = err.message || "";
        if (errorMsg.includes("Too Many Requests") || errorMsg.includes("429") || errorMsg.includes("Throttler")) {
          setDemoError(locale === "zh-TW" ? "請求過於頻繁，請稍候再試" : "Too many requests. Please try again later.");
        } else {
          setDemoError(errorMsg || "Failed to load data");
        }
        setDemoResults([]);
      } finally {
        setDemoLoading(false);
      }
    }

    runScreen();
  }, [selectedStrat, strategyPayloads]);

  // Take top 5 results for clean preview layout
  const displayResults = demoResults.slice(0, 5);

  function formatPrice(val: number) {
    if (val === undefined || val === null) return "-";
    if (val >= 1) return val.toFixed(2);
    if (val >= 0.01) return val.toFixed(4);
    return val.toFixed(6);
  }

  function formatVolume(val: number) {
    if (val === undefined || val === null) return "-";
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Floating Theme / Language Selector */}
      <ThemeLanguageSelector />

      {/* Navigation Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-indigo-600/10 p-1.5 rounded-xl border border-indigo-500/20 group-hover:scale-105 transition-all shadow-md shadow-indigo-500/10">
            <img src="/icon.png" alt="Logo" className="w-6 h-6 object-contain rounded-md" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-zinc-50 via-zinc-100 to-indigo-400 bg-clip-text text-transparent">
            {t.brandName}
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400 light:text-zinc-600">
          <a href="#demo" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {locale === "zh-TW" ? "即時體驗" : "Live Demo"}
          </a>
          <a href="#features" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {locale === "zh-TW" ? "核心優勢" : "Features"}
          </a>
          <a href="#how-it-works" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {locale === "zh-TW" ? "運作流程" : "How It Works"}
          </a>
          <Link href="/privacy" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {t.privacyPolicy}
          </Link>
          <Link href="/terms" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {t.termsOfService}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/MingLin1995/crypto-sniper-v2"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-zinc-400 hover:text-zinc-50 transition-colors bg-zinc-900/60 light:bg-white/60 backdrop-blur-md border border-zinc-800 light:border-zinc-200 rounded-full hover:bg-zinc-800/80 cursor-pointer flex items-center justify-center"
            aria-label="GitHub Repository"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" stroke="none">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow flex flex-col justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24 z-10">
        <div className="text-center max-w-3xl mx-auto space-y-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs font-semibold text-indigo-400 animate-pulse">
            <Zap className="w-3.5 h-3.5" />
            <span>{locale === "zh-TW" ? "即時監控・毫秒通知" : "Real-time monitor & Alerts"}</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
            <span className="block bg-gradient-to-r from-white via-zinc-100 to-indigo-400 bg-clip-text text-transparent">
              {t.brandName}
            </span>
            <span className="block text-2xl sm:text-3xl md:text-4xl text-zinc-400 light:text-zinc-600 font-semibold mt-4">
              {t.tagline}
            </span>
          </h1>

          <p className="text-lg text-zinc-400 light:text-zinc-600 leading-relaxed max-w-2xl mx-auto">
            {t.description}
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Button size="lg" className="hover-premium font-semibold px-8 w-full sm:w-auto" asChild>
              <Link href="/screener">
                {t.getStarted} <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="font-semibold px-8 w-full sm:w-auto hover:bg-zinc-800" asChild>
              <Link href="/register">
                {t.register}
              </Link>
            </Button>
          </div>
        </div>

        {/* Interactive Screener Live Preview */}
        <section id="demo" className="pt-24 space-y-8 max-w-4xl mx-auto w-full animate-scale-in">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
              {t.demoTitle}
            </h2>
            <p className="text-sm text-zinc-400 light:text-zinc-600">
              {t.demoSubtitle}
            </p>
          </div>

          <div className="glass-indigo rounded-2xl p-6 md:p-8 space-y-6">
            {/* Strategy Select Tabs */}
            <div className="flex flex-wrap gap-2 justify-center border-b border-zinc-800/50 pb-5">
              <button
                onClick={() => setSelectedStrat("ema9_21_15m")}
                className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-full transition-all cursor-pointer ${selectedStrat === "ema9_21_15m"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
              >
                {t.strategyTab1}
              </button>
              <button
                onClick={() => setSelectedStrat("sma20_50_4h")}
                className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-full transition-all cursor-pointer ${selectedStrat === "sma20_50_4h"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
              >
                {t.strategyTab2}
              </button>
              <button
                onClick={() => setSelectedStrat("ema50_200_1d")}
                className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-full transition-all cursor-pointer ${selectedStrat === "ema50_200_1d"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
              >
                {t.strategyTab3}
              </button>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto min-h-[220px] flex flex-col justify-center">
              {demoLoading ? (
                <div className="py-12 text-center text-sm text-zinc-400 animate-pulse">
                  {t.loadingText}
                </div>
              ) : isWarmingUp ? (
                <div className="py-12 text-center text-sm text-amber-400">
                  ⚠️ {locale === "zh-TW" ? "行情數據預熱中，請於 10-15 秒後再次點擊切換重試" : "Market data warming up, please switch back and retry in 10-15 seconds"}
                </div>
              ) : demoError ? (
                <div className="py-12 text-center text-sm text-rose-400">
                  {demoError}
                </div>
              ) : displayResults.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">
                  {t.noResults}
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800/50 text-zinc-500 text-xs font-semibold">
                      <th className="py-3 px-4">{t.tableSymbol}</th>
                      <th className="py-3 px-4">{t.tablePrice}</th>
                      <th className="py-3 px-4">{t.tableVolume}</th>
                      <th className="py-3 px-4 text-right">{t.tableAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900/50">
                    {displayResults.map((item) => (
                      <tr key={item.symbol} className="hover:bg-zinc-900/30 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-white flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          {item.symbol}
                        </td>
                        <td className="py-3.5 px-4 font-mono">{formatPrice(item.price)}</td>
                        <td className="py-3.5 px-4 font-mono text-zinc-400">{formatVolume(item.volume)}</td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => setIsUnlockOpen(true)}
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>{t.actionNotify}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-zinc-800/50">
              <button
                onClick={() => setIsUnlockOpen(true)}
                className="inline-flex items-center gap-2 text-xs md:text-sm text-zinc-400 hover:text-zinc-200 transition-colors font-semibold cursor-pointer"
              >
                <Lock className="w-4 h-4 text-indigo-500" />
                <span>{t.customizeBtn}</span>
              </button>

              <span className="text-xs text-zinc-500">
                {locale === "zh-TW" ? `僅顯示前 5 筆符合結果` : `Showing top 5 matches only`}
              </span>
            </div>
          </div>
        </section>

        {/* Feature grid */}
        <section id="features" className="pt-24 pb-12 space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              {t.featuresTitle}
            </h2>
            <p className="text-zinc-400 light:text-zinc-600">
              {t.featuresSub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* Feature 1 */}
            <div className="glass-indigo hover-premium p-8 rounded-2xl space-y-4 animate-scale-in">
              <div className="bg-indigo-600/10 p-3 w-fit rounded-xl border border-indigo-500/20 text-indigo-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">{t.feature1Title}</h3>
              <p className="text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">{t.feature1Desc}</p>
            </div>

            {/* Feature 2 */}
            <div className="glass-indigo hover-premium p-8 rounded-2xl space-y-4 animate-scale-in delay-100">
              <div className="bg-indigo-600/10 p-3 w-fit rounded-xl border border-indigo-500/20 text-indigo-400">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">{t.feature2Title}</h3>
              <p className="text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">{t.feature2Desc}</p>
            </div>

            {/* Feature 3 */}
            <div className="glass-indigo hover-premium p-8 rounded-2xl space-y-4 animate-scale-in delay-200">
              <div className="bg-indigo-600/10 p-3 w-fit rounded-xl border border-indigo-500/20 text-indigo-400">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">{t.feature3Title}</h3>
              <p className="text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">{t.feature3Desc}</p>
            </div>

            {/* Feature 4 */}
            <div className="glass-indigo hover-premium p-8 rounded-2xl space-y-4 animate-scale-in delay-300">
              <div className="bg-indigo-600/10 p-3 w-fit rounded-xl border border-indigo-500/20 text-indigo-400">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">{t.feature4Title}</h3>
              <p className="text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">{t.feature4Desc}</p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="pt-16 pb-12 space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              {t.howItWorksTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass hover-premium p-6 rounded-xl border border-zinc-800 space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-indigo-400" />
                {t.step1Title}
              </h3>
              <p className="text-xs text-zinc-400 light:text-zinc-600 leading-relaxed">{t.step1Desc}</p>
            </div>

            <div className="glass hover-premium p-6 rounded-xl border border-zinc-800 space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-indigo-400" />
                {t.step2Title}
              </h3>
              <p className="text-xs text-zinc-400 light:text-zinc-600 leading-relaxed">{t.step2Desc}</p>
            </div>

            <div className="glass hover-premium p-6 rounded-xl border border-zinc-800 space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-indigo-400" />
                {t.step3Title}
              </h3>
              <p className="text-xs text-zinc-400 light:text-zinc-600 leading-relaxed">{t.step3Desc}</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-zinc-950/80 light:bg-white/80 border-t border-zinc-900 light:border-zinc-200 py-12 z-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-sm text-zinc-400 light:text-zinc-600">
          <div className="space-y-4">
            <span className="text-lg font-bold text-white flex items-center gap-2">
              <img src="/icon.png" alt="Logo" className="w-6 h-6 object-contain rounded-md" />
              {t.brandName}
            </span>
            <p className="text-xs leading-relaxed max-w-sm">
              {t.footerDesc}
            </p>
            <div className="pt-2">
              <a
                href="https://github.com/MingLin1995/crypto-sniper-v2"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-indigo-400 transition-colors font-semibold"
              >
                <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 fill-current" stroke="none">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
                <span>GitHub Repository</span>
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-white">{locale === "zh-TW" ? "相關條款" : "Legal & Privacy"}</h4>
            <div className="flex flex-col gap-2.5">
              <Link href="/privacy" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors w-fit">
                {t.privacyPolicy}
              </Link>
              <Link href="/terms" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors w-fit">
                {t.termsOfService}
              </Link>
            </div>
          </div>

          <div className="space-y-4 col-span-1">
            <h4 className="font-semibold text-white">{t.contactSupport}</h4>
            <p className="text-xs">{t.contactText}</p>
            <p className="text-xs text-zinc-500 pt-2">
              &copy; {new Date().getFullYear()} {t.brandName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Unlock Full Features Modal Dialog */}
      {isUnlockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fade-in-up">
          <div className="relative w-full max-w-md glass-indigo rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl animate-scale-in border border-indigo-500/30">
            {/* Close Button */}
            <button
              onClick={() => setIsUnlockOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-2 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2">
                <Lock className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {t.unlockTitle}
              </h3>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                {t.unlockDesc}
              </p>
            </div>

            {/* Benefit Bullet Points */}
            <ul className="space-y-3.5 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>{t.unlockPoint1}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>{t.unlockPoint2}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>{t.unlockPoint3}</span>
              </li>
            </ul>

            {/* Call to Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" className="font-semibold py-2 w-full hover:bg-zinc-800" asChild>
                <Link href="/login" onClick={() => setIsUnlockOpen(false)}>
                  {t.loginNow}
                </Link>
              </Button>
              <Button className="hover-premium font-semibold py-2 w-full" asChild>
                <Link href="/register" onClick={() => setIsUnlockOpen(false)}>
                  {t.registerFree}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
