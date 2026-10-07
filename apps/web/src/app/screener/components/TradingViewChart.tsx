import * as React from "react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, BellRing } from "lucide-react";
import { ScreenerTimeframeBlock } from "shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TradingViewChartProps {
  locale: string;
  theme: string;
  selectedSymbol: string;
  timeframes: ScreenerTimeframeBlock[];
}

const intervalToTradingView: Record<string, string> = {
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "2h": "120",
  "4h": "240",
  "1d": "D",
  "1w": "W",
  "1M": "M"
};

const intervalOrder = ["5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1M"];

export function TradingViewChart({
  locale,
  theme,
  selectedSymbol,
  timeframes,
}: TradingViewChartProps) {
  const [chartInterval, setChartInterval] = useState<string>("D");
  const [quickCondition, setQuickCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [quickPrice, setQuickPrice] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [channelsEnabled, setChannelsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    const checkChannels = async () => {
      try {
        const meRes = await fetch("/api/users/me");
        if (!meRes.ok) {
          if (active) setChannelsEnabled(false);
          return;
        }
        const meData = await meRes.json();
        const me = meData.data;

        let hasPush = false;
        if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            const subscription = await registration.pushManager.getSubscription();
            hasPush = !!subscription;
          }
        }

        const hasTelegram = !!me.telegramChatId;
        const hasDiscord = !!me.discordWebhook;

        if (active) {
          setChannelsEnabled(hasTelegram || hasDiscord || hasPush);
        }
      } catch (err) {
        console.error("Failed to check notification channels:", err);
        if (active) setChannelsEnabled(false);
      }
    };

    checkChannels();

    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => setStatusMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  const handleCreateQuickAlert = async () => {
    const symbol = selectedSymbol.toUpperCase();
    const targetPrice = parseFloat(quickPrice);

    if (!symbol || isNaN(targetPrice) || targetPrice <= 0) {
      setStatusMsg({
        type: "error",
        text: locale === "zh-TW" ? "請輸入有效的目標價格" : "Please enter a valid target price",
      });
      return;
    }

    setSubmitting(true);
    setStatusMsg(null);

    try {
      // 1. 取得用戶最新設定以判斷是否啟用管道
      const meRes = await fetch("/api/users/me");
      if (!meRes.ok) {
        throw new Error(locale === "zh-TW" ? "驗證用戶身分失敗" : "Failed to verify user profile");
      }
      const meData = await meRes.json();
      const me = meData.data;

      // 2. 檢查瀏覽器 Web Push 是否訂閱
      let hasPush = false;
      if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          hasPush = !!subscription;
        }
      }

      const hasTelegram = !!me.telegramChatId;
      const hasDiscord = !!me.discordWebhook;

      if (!hasTelegram && !hasDiscord && !hasPush) {
        setStatusMsg({
          type: "error",
          text: locale === "zh-TW"
            ? "請先設定並啟用至少一種通知管道 (瀏覽器推送、Discord Webhook 或 Telegram Bot)"
            : "Please enable at least one notification channel (Browser Push, Discord Webhook, or Telegram Bot) first.",
        });
        setSubmitting(false);
        return;
      }

      // 3. 送出設定
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          condition: quickCondition,
          targetPrice,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "設定失敗");
      }

      setStatusMsg({
        type: "success",
        text: locale === "zh-TW" ? "已成功設定到價通知！" : "Price notification set successfully!",
      });
      setQuickPrice("");
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const activeIntervals = React.useMemo(() => {
    const labels = timeframes.length > 0
      ? intervalOrder.filter((i) => timeframes.some((tf) => tf.interval === i))
      : ["15m", "1h", "4h", "1d"];
    return labels.map((label) => ({
      label,
      value: intervalToTradingView[label] || label,
    }));
  }, [timeframes]);

  // 當可選週期變更時，若當前選擇的不在候選名單中，預設改選第一個
  useEffect(() => {
    const validValues = activeIntervals.map((item) => item.value);
    if (!validValues.includes(chartInterval)) {
      if (validValues.length > 0) {
        setChartInterval(validValues[0]);
      }
    }
  }, [activeIntervals, chartInterval]);
  // TradingView Widget 實例化與均線指標同步
  useEffect(() => {
    let active = true;

    const initWidget = () => {
      if (!active || !(window as any).TradingView) return;

      const container = document.getElementById("tradingview_chart_container");
      if (container) {
        container.replaceChildren();
      }

      const chartStudies: any[] = [];

      // 1. 找出與目前圖表週期相符的篩選時框條件
      const activeTf = timeframes.find((tf) => {
        const tvVal = intervalToTradingView[tf.interval] || tf.interval;
        return tvVal === chartInterval;
      });

      // 2. 提取出所有不重複的指標 (相容 EMA, SMA, RSI, MACD)
      const uniqueStudies: { type: "EMA" | "SMA" | "RSI" | "MACD"; period?: number }[] = [];
      if (activeTf) {
        activeTf.conditions.forEach((cond) => {
          const type1 = cond.type || cond.ma1Type || "EMA";
          const p1 = cond.period !== undefined && cond.period !== "" ? Number(cond.period) : (cond.ma1Period !== "" ? Number(cond.ma1Period) : 0);
          
          if (type1 === "EMA" || type1 === "SMA") {
            if (p1 > 0) {
              const exists = uniqueStudies.some((s) => s.type === type1 && s.period === p1);
              if (!exists) uniqueStudies.push({ type: type1, period: p1 });
            }
          } else if (type1 === "RSI") {
            const exists = uniqueStudies.some((s) => s.type === "RSI");
            if (!exists) uniqueStudies.push({ type: "RSI", period: p1 || 14 });
          } else if (type1 === "MACD") {
            const exists = uniqueStudies.some((s) => s.type === "MACD");
            if (!exists) uniqueStudies.push({ type: "MACD" });
          }

          const compareType = cond.compareType || "indicator";
          if (compareType === "indicator") {
            const type2 = cond.compareIndicatorType || cond.ma2Type || "EMA";
            const p2 = cond.comparePeriod !== undefined && cond.comparePeriod !== "" ? Number(cond.comparePeriod) : (cond.ma2Period !== "" ? Number(cond.ma2Period) : 0);
            
            if (type2 === "EMA" || type2 === "SMA") {
              if (p2 > 0) {
                const exists = uniqueStudies.some((s) => s.type === type2 && s.period === p2);
                if (!exists) uniqueStudies.push({ type: type2, period: p2 });
              }
            } else if (type2 === "RSI") {
              const exists = uniqueStudies.some((s) => s.type === "RSI");
              if (!exists) uniqueStudies.push({ type: "RSI", period: p2 || 14 });
            } else if (type2 === "MACD") {
              const exists = uniqueStudies.some((s) => s.type === "MACD");
              if (!exists) uniqueStudies.push({ type: "MACD" });
            }
          }
        });
      }

      // 3. 將指標放入載入清單之中
      uniqueStudies.forEach((study) => {
        if (study.type === "EMA") {
          chartStudies.push({
            id: "MAExp@tv-basicstudies",
            inputs: { length: study.period }
          });
        } else if (study.type === "SMA") {
          chartStudies.push({
            id: "MASimple@tv-basicstudies",
            inputs: { length: study.period }
          });
        } else if (study.type === "RSI") {
          chartStudies.push({
            id: "RSI@tv-basicstudies",
            inputs: { length: study.period || 14 }
          });
        } else if (study.type === "MACD") {
          chartStudies.push({
            id: "MACD@tv-basicstudies"
          });
        }
      });

      new (window as any).TradingView.widget({
        width: "100%",
        height: 520,
        symbol: `BINANCE:${selectedSymbol}.P`,
        interval: chartInterval,
        timezone: "Etc/UTC",
        theme: theme === "light" ? "light" : "dark",
        style: "1",
        locale: locale === "zh-TW" ? "zh_TW" : "en",
        toolbar_bg: "#f1f3f6",
        enable_publishing: false,
        hide_side_toolbar: true,
        allow_symbol_change: true,
        save_image: true,
        container_id: "tradingview_chart_container",
        // 註記：TradingView 免費嵌入版 Widget 最多只支援顯示 5 個技術指標，超過的會被自動忽略
        studies: chartStudies.slice(0, 5),
      });
    };

    const existingScript = document.getElementById("tradingview-tv-script");
    if (!(window as any).TradingView && !existingScript) {
      const script = document.createElement("script");
      script.id = "tradingview-tv-script";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      script.onload = () => {
        if (active) initWidget();
      };
      document.head.appendChild(script);
    } else if ((window as any).TradingView) {
      initWidget();
    } else if (existingScript) {
      // 若腳本正在載入，則輪詢直到 window.TradingView 可用
      const interval = setInterval(() => {
        if ((window as any).TradingView) {
          if (active) initWidget();
          clearInterval(interval);
        }
      }, 100);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    return () => {
      active = false;
    };
  }, [selectedSymbol, chartInterval, theme, locale, timeframes]);

  return (
    <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up delay-300 hover-premium">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <LineChart className="h-5 w-5 text-indigo-400" />
            {locale === "zh-TW" ? `TradingView - ${selectedSymbol}` : `TradingView - ${selectedSymbol}`}
          </CardTitle>
          <CardDescription>
            {locale === "zh-TW"
              ? "點選上方篩選出的交易對以切換圖表標的。（註：免費圖表最多僅能同時顯示 5 個指標）"
              : "Select a pair above to update the chart. (Note: Free chart displays up to 5 indicators simultaneously.)"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {selectedSymbol ? (
          <div className="space-y-3">
            {/* Interval selector tabs */}
            <div className="flex items-center justify-between bg-zinc-900/40 light:bg-slate-100 border border-zinc-800/60 light:border-zinc-200 p-1.5 rounded-lg">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-zinc-400 light:text-zinc-600 px-2 font-medium">
                  {locale === "zh-TW" ? "圖表週期：" : "Interval:"}
                </span>
                {activeIntervals.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setChartInterval(item.value)}
                    className={`text-xs font-semibold px-3 py-1 rounded-md transition-all cursor-pointer ${chartInterval === item.value
                      ? "bg-indigo-500 text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]"
                      : "text-zinc-400 light:text-zinc-600 hover:text-indigo-400 light:hover:text-indigo-600 hover:bg-zinc-800/50 light:hover:bg-zinc-200/50"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-zinc-500 light:text-zinc-400 px-2 flex items-center gap-1.5 font-mono">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                BINANCE:{selectedSymbol}.P
              </div>
            </div>

            <div id="tradingview_chart_container" className="w-full h-[520px] rounded-lg overflow-hidden border border-zinc-800 light:border-zinc-200 bg-zinc-950 light:bg-slate-50" />

            {/* Quick Price Alert setup panel */}
            <div className="mt-4 p-4 rounded-xl bg-zinc-900/40 light:bg-slate-100/40 border border-zinc-800/80 light:border-zinc-200/80 flex flex-col md:flex-row items-center justify-between gap-4 transition-all">
              <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <BellRing className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-200 light:text-zinc-800">
                    {locale === "zh-TW" ? "快速設定到價通知" : "Quick Alert Setup"}
                  </h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {locale === "zh-TW" ? `監控標的：${selectedSymbol}` : `Monitoring: ${selectedSymbol}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 w-full justify-end">
                {/* Status message display */}
                {statusMsg && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded border mr-auto sm:mr-0 ${
                    statusMsg.type === "success"
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-red-500/15 border-red-500/30 text-red-400"
                  }`}>
                    {statusMsg.text}
                  </span>
                )}

                {channelsEnabled === false ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg text-red-400">
                    <span className="text-xs font-semibold">
                      ⚠️ {locale === "zh-TW"
                        ? "請先啟用至少一種通知管道 (瀏覽器推送、Discord 或 Telegram) 才能使用快速設定通知。"
                        : "Please enable at least one notification channel (Browser Push, Discord, or Telegram) to configure quick notifications."}
                    </span>
                    <Button
                      onClick={() => window.location.href = "/alerts?tab=channels"}
                      className="cursor-pointer bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3.5 h-8.5 shrink-0 w-full sm:w-auto"
                    >
                      {locale === "zh-TW" ? "前往啟用" : "Go to Enable"}
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Condition above/below toggle */}
                    <div className="flex items-center gap-1 border border-zinc-800 light:border-zinc-300 p-1 rounded-lg bg-zinc-950/80 light:bg-slate-50 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={channelsEnabled === null}
                        onClick={() => setQuickCondition("ABOVE")}
                        className={`flex-1 sm:flex-initial text-[11px] font-bold px-3 py-1 rounded-md transition-all cursor-pointer ${
                          quickCondition === "ABOVE"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                            : "text-zinc-500 light:text-zinc-600 hover:text-zinc-300 light:hover:text-zinc-900"
                        }`}
                      >
                        ▲ {locale === "zh-TW" ? "高於" : "ABOVE"}
                      </button>
                      <button
                        type="button"
                        disabled={channelsEnabled === null}
                        onClick={() => setQuickCondition("BELOW")}
                        className={`flex-1 sm:flex-initial text-[11px] font-bold px-3 py-1 rounded-md transition-all cursor-pointer ${
                          quickCondition === "BELOW"
                            ? "bg-red-500/15 text-red-400 border border-red-500/25"
                            : "text-zinc-500 light:text-zinc-600 hover:text-zinc-300 light:hover:text-zinc-900"
                        }`}
                      >
                        ▼ {locale === "zh-TW" ? "低於" : "BELOW"}
                      </button>
                    </div>

                    {/* Price input field */}
                    <div className="w-full sm:w-36">
                      <Input
                        type="number"
                        step="any"
                        disabled={channelsEnabled === null}
                        placeholder={locale === "zh-TW" ? "目標價格" : "Target Price"}
                        value={quickPrice}
                        onChange={(e) => setQuickPrice(e.target.value)}
                        className="w-full h-8.5 font-mono text-xs border-indigo-500/25 light:border-zinc-300 bg-zinc-950/40 light:bg-white light:text-zinc-900"
                      />
                    </div>

                    {/* Submit button */}
                    <Button
                      onClick={handleCreateQuickAlert}
                      loading={submitting}
                      disabled={channelsEnabled === null}
                      className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 h-8.5 w-full sm:w-auto"
                    >
                      {locale === "zh-TW" ? "設定通知" : "Set Alert"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-800 light:border-zinc-200 rounded-lg text-zinc-500">
            <LineChart className="h-10 w-10 text-zinc-700 animate-pulse mb-3" />
            <span className="text-sm">{locale === "zh-TW" ? "請先篩選並選擇一個交易對來顯示圖表" : "Select a pair to display chart"}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
