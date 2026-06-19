import * as React from "react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "lucide-react";
import { ScreenerTimeframeBlock } from "shared";

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

      // 2. 提取出所有不重複的均線 (EMA / SMA 與對應週期，相容字串與數值型別)
      const uniqueMAs: { type: "EMA" | "SMA"; period: number }[] = [];
      if (activeTf) {
        activeTf.conditions.forEach((cond) => {
          const p1 = cond.ma1Period !== "" ? Number(cond.ma1Period) : 0;
          const p2 = cond.ma2Period !== "" ? Number(cond.ma2Period) : 0;

          if (p1 > 0) {
            const exists = uniqueMAs.some(
              (ma) => ma.type === cond.ma1Type && ma.period === p1
            );
            if (!exists) {
              uniqueMAs.push({ type: cond.ma1Type, period: p1 });
            }
          }
          if (p2 > 0) {
            const exists = uniqueMAs.some(
              (ma) => ma.type === cond.ma2Type && ma.period === p2
            );
            if (!exists) {
              uniqueMAs.push({ type: cond.ma2Type, period: p2 });
            }
          }
        });
      }

      // 3. 將均線放入指標載入清單之中
      uniqueMAs.forEach((ma) => {
        if (ma.type === "EMA") {
          chartStudies.push({
            id: "MAExp@tv-basicstudies",
            inputs: { length: ma.period }
          });
        } else {
          chartStudies.push({
            id: "MASimple@tv-basicstudies",
            inputs: { length: ma.period }
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
    <Card className="border-indigo-500/15 glass-indigo">
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
