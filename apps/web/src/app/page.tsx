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
  LineChart,
  BarChart2,
} from "lucide-react";

const pageTranslations = {
  "zh-TW": {
    brandName: "CryptoSniper V2",
    tagline: "多時框加密貨幣策略篩選、量化回測與即時到價通知平台",
    description: "專為專業交易者打造的一站式量化決策平台。整合多時框技術指標篩選（RSI、MACD、EMA）、歷史行情策略回測（勝率/MDD/淨值曲線分析）以及毫秒級 Telegram / Discord 即時到價監控通知，讓您隨時掌握行情、精準狙擊交易機會。",
    heroBadge: "即時監控・量化回測・毫秒通知",
    getStarted: "進入篩選器",
    goToBacktest: "前往策略回測",
    register: "免費註冊",
    featuresTitle: "核心功能優勢",
    featuresSub: "為您提供最精準、快速的加密貨幣篩選、回測驗證與即時通知服務",
    feature1Title: "實時策略篩選器",
    feature1Desc: "在多個時間維度（5m 至 1d）上同時監控多個交易對的 RSI、MACD、KDJ 等多種技術指標，一目了然。",
    feature2Title: "量化策略回測引擎",
    feature2Desc: "以真實歷史 K 線大數據深度模擬撮合！支援多時框條件、槓桿部位模擬、動態止盈止損與指標反向平倉，即時評估勝率、最大回撤（MDD）與淨值曲線。",
    feature3Title: "靈活風控與自訂條件",
    feature3Desc: "支援設定固定停損停利、指標出場、多時框均線排列等多樣化策略，完美契合您的風控準則與交易邏輯。",
    feature4Title: "多管道即時推播通知",
    feature4Desc: "一旦價格或指標觸及設定條件，系統在毫秒內透過 Telegram Bot、Discord Webhook 及網頁 Push 進行通知，7x24 全天候穩定運行不漏報。",
    howItWorksTitle: "量化交易三步閉環",
    step1Title: "1. 發現機會：多時框篩選",
    step1Desc: "在多個時間週期（5m 至 1d）上組合自訂技術指標（EMA、RSI、MACD），一鍵即時掃描全市場潛在突破標的。",
    step2Title: "2. 驗證策略：歷史量化回測",
    step2Desc: "以真實歷史 K 線數據模擬撮合，檢驗策略勝率、盈虧比與最大回撤（MDD），在投入真金白銀前最佳化風控參數。",
    step3Title: "3. 部署監控：毫秒到價推播",
    step3Desc: "將驗證成功的策略部署至雲端 24/7 自動監控，觸發買賣訊號時在毫秒內透過 Telegram 或 Discord 推送通知。",
    footerDesc: "CryptoSniper V2 致力於為加密貨幣交易者提供最專業、即時的行情篩選、量化回測與多管道到價通知服務，助您在瞬息萬變的市場中把握良機。",
    privacyPolicy: "隱私權政策",
    termsOfService: "服務條款",
    contactSupport: "聯絡我們 / 技術支援",
    contactText: "如有任何問題或需求，請聯絡 minglin.net@gmail.com",

    // Navigation
    navDemo: "即時篩選",
    navBacktest: "策略回測",
    navFeatures: "核心優勢",
    navHowItWorks: "運作流程",

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

    // Backtest Showcase Keys
    backtestTitle: "量化策略回測引擎展示",
    backtestSubtitle: "以真實歷史 K 線大數據模擬撮合，即時掌握勝率、盈虧比與資產成長淨值曲線",
    backtestTab1: "BTC 雙均線突破 (15m)",
    backtestTab2: "ETH 多頭排列趨勢 (4h)",
    backtestTab3: "SOL RSI 超賣逆勢 (1h)",
    backtestRoi: "投資回報率 (ROI)",
    backtestAnnualized: "年化",
    backtestWinRate: "回測勝率",
    backtestProfitFactor: "盈虧比",
    backtestMdd: "最大回撤 (MDD)",
    backtestSharpe: "夏普比率 (Sharpe)",
    backtestTrades: "交易總數",
    backtestTradesDetail: "筆",
    backtestWinCount: "勝",
    backtestLossCount: "敗",
    backtestEquityTitle: "模擬資金淨值成長曲線 (Equity Curve)",
    backtestInitialCapital: "初始資金",
    backtestFinalCapital: "最終淨值",
    backtestBenchmarkTitle: "BTC 基準對照",
    backtestBtcBuyHold: "BTC 買進持有",
    backtestBtcDca: "BTC 定期定額",
    backtestCurrentStrategy: "當前策略報酬",
    backtestCta: "前往回測系統自訂策略",
    backtestPeriodBadge: "近 90 天完整 K 線回放撮合",
    backtestRiskLabel: "風控配置",
    backtestRiskDetail: "停損 5%・動態出場",
    backtestAutoReverse: "反向訊號平倉保護",

    unlockTitle: "解鎖完整功能",
    unlockDesc: "加入 CryptoSniper 即可解鎖完整功能！註冊帳戶後，您將可以：",
    unlockPoint1: "配置更複雜的多時間週期與自訂技術指標組合篩選（如 RSI 超賣、MACD 交叉、多重均線組合）。",
    unlockPoint2: "無限次歷史 K 線策略回測，支援自訂槓桿、固定/指標動態止盈止損與風險部位管理。",
    unlockPoint3: "一鍵串接 Telegram Bot 或 Discord Webhook，當市場滿足條件時，在毫秒內自動傳送到價通知。",
    unlockPoint4: "管理個人專屬策略分類與自選追蹤清單，由系統 24/7 全天候在雲端自動監控運行。",
    loginNow: "立即登入",
    registerFree: "免費註冊",
    close: "關閉",
  },
  "en-US": {
    brandName: "CryptoSniper V2",
    tagline: "Multi-Timeframe Crypto Screener, Quantitative Backtester & Instant Alerts",
    description: "An enterprise-grade quantitative trading platform. Seamlessly integrate multi-timeframe technical indicator screening (RSI, MACD, MA), historical strategy backtesting (win rate, MDD, equity curve simulation), and millisecond-level Telegram / Discord price alerts.",
    heroBadge: "Real-time Monitor・Backtest Engine・Instant Alerts",
    getStarted: "Go to Screener",
    goToBacktest: "Try Backtester",
    register: "Register Free",
    featuresTitle: "Core Features",
    featuresSub: "Providing accurate, lightning-fast crypto screening, backtesting verification, and alerts.",
    feature1Title: "Real-Time Strategy Screener",
    feature1Desc: "Simultaneously monitor multiple trading pairs across various timeframes (5m to 1d) with technical indicators like RSI, MACD, and KDJ.",
    feature2Title: "Quantitative Backtest Engine",
    feature2Desc: "Replay historical OHLCV candles to simulate trades. Support multi-timeframe rules, leverage, dynamic take-profit/stop-loss, producing equity curves, win rates, and Sharpe ratios.",
    feature3Title: "Flexible Risk Management & Rules",
    feature3Desc: "Configure fixed TP/SL, indicator-based exits, reverse signal closing, and risk-based sizing to fit your exact trading discipline.",
    feature4Title: "Instant Multi-Channel Alerts",
    feature4Desc: "Once prices or indicators trigger your custom criteria, receive notifications in milliseconds via Telegram, Discord, and Web Push with 24/7 reliability.",
    howItWorksTitle: "How It Works: 3-Step Quant Lifecycle",
    step1Title: "1. Screen & Discover",
    step1Desc: "Scan the entire market across multiple timeframes (5m to 1d) with combined technical indicators to find high-probability setups.",
    step2Title: "2. Verify: Historical Backtesting",
    step2Desc: "Replay historical market data to evaluate win rate, profit factor, and maximum drawdown (MDD), fine-tuning risk parameters before risking capital.",
    step3Title: "3. Deploy & Alert 24/7",
    step3Desc: "Deploy your validated strategies for continuous 24/7 scanning, receiving alerts via Telegram Bot or Discord within milliseconds.",
    footerDesc: "CryptoSniper V2 is dedicated to providing professional, real-time market screening, backtesting, and multi-channel price alerts to help you capture every opportunity in volatile crypto markets.",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    contactSupport: "Contact / Support",
    contactText: "For any questions or inquiries, contact minglin.net@gmail.com",

    // Navigation
    navDemo: "Live Screener",
    navBacktest: "Backtest",
    navFeatures: "Features",
    navHowItWorks: "How It Works",

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

    // Backtest Showcase Keys
    backtestTitle: "Quantitative Backtesting Engine",
    backtestSubtitle: "Simulate strategy performance with historical OHLCV data to evaluate win rate, profit factor, and equity curve.",
    backtestTab1: "BTC EMA Breakout (15m)",
    backtestTab2: "ETH Bullish Trend (4h)",
    backtestTab3: "SOL RSI Reversal (1h)",
    backtestRoi: "Return on Investment (ROI)",
    backtestAnnualized: "Annualized",
    backtestWinRate: "Win Rate",
    backtestProfitFactor: "Profit Factor",
    backtestMdd: "Max Drawdown (MDD)",
    backtestSharpe: "Sharpe Ratio",
    backtestTrades: "Total Trades",
    backtestTradesDetail: "trades",
    backtestWinCount: "Win",
    backtestLossCount: "Loss",
    backtestEquityTitle: "Simulated Strategy Equity Curve",
    backtestInitialCapital: "Initial Capital",
    backtestFinalCapital: "Final Equity",
    backtestBenchmarkTitle: "BTC Benchmarks",
    backtestBtcBuyHold: "BTC Buy & Hold",
    backtestBtcDca: "BTC Monthly DCA",
    backtestCurrentStrategy: "Strategy ROI",
    backtestCta: "Go to Backtester & Customize",
    backtestPeriodBadge: "90-Day Full OHLCV Candle Replay",
    backtestRiskLabel: "Risk Setup",
    backtestRiskDetail: "SL 5%・Signal Exit",
    backtestAutoReverse: "Reverse Signal Protect",

    unlockTitle: "Unlock Full Features",
    unlockDesc: "Join CryptoSniper to unlock all capabilities! Once registered, you will be able to:",
    unlockPoint1: "Configure advanced multi-timeframe indicator filters (e.g. RSI oversold, MACD crossovers, multi-MA combinations).",
    unlockPoint2: "Unlimited historical strategy backtesting with custom leverage, dynamic stop-loss/take-profit, and equity charts.",
    unlockPoint3: "Link your Telegram Bot or Discord Webhook to receive instant alerts within milliseconds.",
    unlockPoint4: "Manage your custom strategies and watchlists under continuous 24/7 scanning.",
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

  // Stateful backtest showcase states
  const [selectedBacktestStrat, setSelectedBacktestStrat] = React.useState<"btc" | "eth" | "sol">("btc");

  const backtestDemoData = React.useMemo(() => ({
    btc: {
      symbol: "BTC/USDT",
      timeframe: "15m",
      logic: "EMA 9 > EMA 21 (15m) + EMA 50 > EMA 200 (1h)",
      initialCapital: 10000,
      finalCapital: 15842,
      roi: 58.42,
      annualizedRoi: 142.5,
      winRate: 68.2,
      profitFactor: 2.18,
      maxDrawdown: -7.54,
      sharpe: 2.31,
      totalTrades: 86,
      winningTrades: 59,
      losingTrades: 27,
      btcBuyHold: 28.4,
      btcDca: 14.2,
      points: [
        10000, 10250, 10180, 10620, 10940, 10810, 11450, 11980, 11620, 12340,
        12890, 12610, 13420, 13950, 13780, 14520, 15120, 14910, 15480, 15842,
      ],
    },
    eth: {
      symbol: "ETH/USDT",
      timeframe: "4h",
      logic: "SMA 20 > SMA 50 (4h) + RSI > 50 (4h)",
      initialCapital: 10000,
      finalCapital: 19460,
      roi: 94.6,
      annualizedRoi: 210.8,
      winRate: 72.5,
      profitFactor: 2.64,
      maxDrawdown: -11.2,
      sharpe: 2.78,
      totalTrades: 48,
      winningTrades: 35,
      losingTrades: 13,
      btcBuyHold: 35.1,
      btcDca: 18.5,
      points: [
        10000, 10420, 10850, 10610, 11340, 12100, 11750, 12900, 13850, 14620,
        14210, 15300, 16450, 16120, 17280, 18100, 17650, 18600, 19120, 19460,
      ],
    },
    sol: {
      symbol: "SOL/USDT",
      timeframe: "1h",
      logic: "RSI < 30 (1h) + KDJ K < 20 (1h)",
      initialCapital: 10000,
      finalCapital: 14680,
      roi: 46.8,
      annualizedRoi: 118.3,
      winRate: 64.0,
      profitFactor: 1.95,
      maxDrawdown: -9.85,
      sharpe: 1.89,
      totalTrades: 50,
      winningTrades: 32,
      losingTrades: 18,
      btcBuyHold: 22.3,
      btcDca: 11.8,
      points: [
        10000, 9780, 10320, 10150, 10720, 11200, 10940, 11650, 12100, 11800,
        12450, 12980, 12710, 13350, 13820, 13540, 14100, 13920, 14380, 14680,
      ],
    },
  }), []);

  const currentBacktest = backtestDemoData[selectedBacktestStrat];

  // Generate SVG path for equity curve
  const chartSvgData = React.useMemo(() => {
    const points = currentBacktest.points;
    const width = 600;
    const height = 180;
    const minVal = Math.min(...points) * 0.98;
    const maxVal = Math.max(...points) * 1.02;
    const range = maxVal - minVal || 1;
    const padX = 20;
    const padY = 25;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const coords = points.map((p, i) => {
      const x = padX + (i / (points.length - 1)) * chartW;
      const y = padY + (1 - (p - minVal) / range) * chartH;
      return { x, y, val: p };
    });

    const linePath = coords.reduce((acc, curr, i) => {
      return i === 0 ? `M ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}` : `${acc} L ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }, "");

    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height - 5} L ${coords[0].x.toFixed(1)} ${height - 5} Z`;

    return {
      linePath,
      areaPath,
      firstPoint: coords[0],
      lastPoint: coords[coords.length - 1],
      coords,
    };
  }, [currentBacktest]);

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
            {t.navDemo}
          </a>
          <a href="#backtest" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {t.navBacktest}
          </a>
          <a href="#features" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {t.navFeatures}
          </a>
          <a href="#how-it-works" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {t.navHowItWorks}
          </a>
          <Link href="/privacy" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {t.privacyPolicy}
          </Link>
          <Link href="/terms" className="hover:text-indigo-400 light:hover:text-indigo-600 transition-colors">
            {t.termsOfService}
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button size="sm" className="hover-premium font-semibold text-xs px-3.5" asChild>
            <Link href="/screener">
              {locale === "zh-TW" ? "進入系統" : "Console"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
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
            <span>{t.heroBadge}</span>
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
            <Button size="lg" variant="outline" className="font-semibold px-8 w-full sm:w-auto border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300" asChild>
              <Link href="/backtest">
                <LineChart className="mr-2 h-4 w-4" /> {t.goToBacktest}
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

        {/* Backtest Results & Engine Showcase Section */}
        <section id="backtest" className="pt-24 space-y-8 max-w-4xl mx-auto w-full animate-scale-in">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              <LineChart className="w-6 h-6 text-indigo-400 animate-pulse" />
              {t.backtestTitle}
            </h2>
            <p className="text-sm text-zinc-400 light:text-zinc-600">
              {t.backtestSubtitle}
            </p>
          </div>

          <div className="glass-indigo rounded-2xl p-6 md:p-8 space-y-6">
            {/* Backtest Strategy Selector Tabs */}
            <div className="flex flex-wrap gap-2 justify-center border-b border-zinc-800/50 pb-5">
              <button
                onClick={() => setSelectedBacktestStrat("btc")}
                className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-full transition-all cursor-pointer ${
                  selectedBacktestStrat === "btc"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {t.backtestTab1}
              </button>
              <button
                onClick={() => setSelectedBacktestStrat("eth")}
                className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-full transition-all cursor-pointer ${
                  selectedBacktestStrat === "eth"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {t.backtestTab2}
              </button>
              <button
                onClick={() => setSelectedBacktestStrat("sol")}
                className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-full transition-all cursor-pointer ${
                  selectedBacktestStrat === "sol"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {t.backtestTab3}
              </button>
            </div>

            {/* Strategy Logic Header Pill */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/60 p-3.5 rounded-xl border border-indigo-500/20 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30">
                  {currentBacktest.symbol} ({currentBacktest.timeframe})
                </span>
                <span className="text-zinc-300 font-mono">
                  {currentBacktest.logic}
                </span>
              </div>
              <span className="text-[11px] text-indigo-300 font-semibold shrink-0">
                ⏱ {t.backtestPeriodBadge}
              </span>
            </div>

            {/* Benchmark Comparison Bar */}
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                <span className="font-bold text-zinc-200">
                  {t.backtestBenchmarkTitle}：
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono text-xs">
                <div>
                  <span className="text-zinc-400">{t.backtestBtcBuyHold}：</span>
                  <span className="font-bold text-emerald-400">
                    +{currentBacktest.btcBuyHold}%
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400">{t.backtestBtcDca}：</span>
                  <span className="font-bold text-emerald-400">
                    +{currentBacktest.btcDca}%
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400">{t.backtestCurrentStrategy}：</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    +{currentBacktest.roi}%
                  </span>
                </div>
              </div>
            </div>

            {/* 5 KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* ROI */}
              <div className="bg-zinc-900/40 rounded-xl p-3.5 border border-indigo-500/10 space-y-1">
                <div className="text-[11px] text-zinc-400 font-medium">{t.backtestRoi}</div>
                <div className="text-xl font-black text-emerald-400 font-mono">+{currentBacktest.roi}%</div>
                <div className="text-[10px] text-zinc-500">{t.backtestAnnualized}: +{currentBacktest.annualizedRoi}%</div>
              </div>

              {/* Win Rate */}
              <div className="bg-zinc-900/40 rounded-xl p-3.5 border border-indigo-500/10 space-y-1">
                <div className="text-[11px] text-zinc-400 font-medium">{t.backtestWinRate}</div>
                <div className="text-xl font-black text-indigo-400 font-mono">{currentBacktest.winRate}%</div>
                <div className="text-[10px] text-zinc-500">{t.backtestProfitFactor}: {currentBacktest.profitFactor}</div>
              </div>

              {/* MDD */}
              <div className="bg-zinc-900/40 rounded-xl p-3.5 border border-indigo-500/10 space-y-1">
                <div className="text-[11px] text-zinc-400 font-medium">{t.backtestMdd}</div>
                <div className="text-xl font-black text-rose-400 font-mono">{currentBacktest.maxDrawdown}%</div>
                <div className="text-[10px] text-zinc-500">{t.backtestSharpe}: {currentBacktest.sharpe}</div>
              </div>

              {/* Total Trades */}
              <div className="bg-zinc-900/40 rounded-xl p-3.5 border border-indigo-500/10 space-y-1">
                <div className="text-[11px] text-zinc-400 font-medium">{t.backtestTrades}</div>
                <div className="text-xl font-black text-zinc-100 font-mono">
                  {currentBacktest.totalTrades} <span className="text-xs font-normal text-zinc-400">{t.backtestTradesDetail}</span>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  <span className="text-emerald-400">{currentBacktest.winningTrades}{t.backtestWinCount}</span> / <span className="text-rose-400">{currentBacktest.losingTrades}{t.backtestLossCount}</span>
                </div>
              </div>

              {/* Leverage & Risk Sizing */}
              <div className="bg-zinc-900/40 rounded-xl p-3.5 border border-indigo-500/10 space-y-1 col-span-2 sm:col-span-1">
                <div className="text-[11px] text-zinc-400 font-medium">{t.backtestRiskLabel}</div>
                <div className="text-sm font-bold text-zinc-200 flex items-center gap-1.5 pt-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono">5x</span>
                  <span className="text-xs">{t.backtestRiskDetail}</span>
                </div>
                <div className="text-[10px] text-emerald-400 font-semibold">{t.backtestAutoReverse}</div>
              </div>
            </div>

            {/* Simulated Equity Curve SVG Chart */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-zinc-400 px-1">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-indigo-400" />
                  {t.backtestEquityTitle}
                </span>
                <span className="font-mono text-zinc-500">
                  {t.backtestInitialCapital}: <span className="text-zinc-300 font-bold">${currentBacktest.initialCapital.toLocaleString()}</span> ➔ {t.backtestFinalCapital}: <span className="text-emerald-400 font-bold">${currentBacktest.finalCapital.toLocaleString()} USDT</span>
                </span>
              </div>

              <div className="relative w-full h-[180px] bg-zinc-950/60 rounded-xl p-3 border border-indigo-500/15 overflow-hidden">
                <svg viewBox="0 0 600 180" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                      <stop offset="80%" stopColor="#6366f1" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Subtle Grid Lines */}
                  <line x1="20" y1="35" x2="580" y2="35" stroke="#27272a" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="20" y1="85" x2="580" y2="85" stroke="#27272a" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="20" y1="135" x2="580" y2="135" stroke="#27272a" strokeDasharray="3 3" strokeWidth="1" />

                  {/* Filled Area */}
                  <path d={chartSvgData.areaPath} fill="url(#equityGradient)" />

                  {/* Line */}
                  <path
                    d={chartSvgData.linePath}
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-500"
                  />

                  {/* Start Point */}
                  <circle cx={chartSvgData.firstPoint.x} cy={chartSvgData.firstPoint.y} r="3.5" fill="#a5b4fc" />

                  {/* End Peak Point */}
                  <circle cx={chartSvgData.lastPoint.x} cy={chartSvgData.lastPoint.y} r="4.5" fill="#4ade80" className="animate-pulse" />
                </svg>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-zinc-800/50">
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{locale === "zh-TW" ? "支援自訂時間區間、槓桿倍數、自訂止盈止損及資金管理模式" : "Supports custom date ranges, leverage, dynamic TP/SL, and position sizing"}</span>
              </div>
              <Button className="hover-premium font-semibold text-xs px-6 w-full sm:w-auto" asChild>
                <Link href="/backtest">
                  {t.backtestCta} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
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

            {/* Feature 2: Backtest Engine */}
            <div className="glass-indigo hover-premium p-8 rounded-2xl space-y-4 animate-scale-in delay-100">
              <div className="bg-indigo-600/10 p-3 w-fit rounded-xl border border-indigo-500/20 text-indigo-400">
                <BarChart2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">{t.feature2Title}</h3>
              <p className="text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">{t.feature2Desc}</p>
            </div>

            {/* Feature 3: Risk & Rules */}
            <div className="glass-indigo hover-premium p-8 rounded-2xl space-y-4 animate-scale-in delay-200">
              <div className="bg-indigo-600/10 p-3 w-fit rounded-xl border border-indigo-500/20 text-indigo-400">
                <Settings className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">{t.feature3Title}</h3>
              <p className="text-sm text-zinc-400 light:text-zinc-600 leading-relaxed">{t.feature3Desc}</p>
            </div>

            {/* Feature 4: Instant Multi-Channel Alerts */}
            <div className="glass-indigo hover-premium p-8 rounded-2xl space-y-4 animate-scale-in delay-300">
              <div className="bg-indigo-600/10 p-3 w-fit rounded-xl border border-indigo-500/20 text-indigo-400">
                <Bell className="w-6 h-6" />
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
              <li className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>{t.unlockPoint4}</span>
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
