import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, RefreshCw, Search, LineChart, ChevronRight, Star } from "lucide-react";

interface ScreenerResultItem {
  symbol: string;
  price: number;
  volume: number;
}

interface ScreenerResultsProps {
  locale: string;
  loading: boolean;
  isWarmingUp: boolean;
  results: ScreenerResultItem[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  handleScreen: () => void;
  watchlistItems?: any[];
  onToggleWatchlist?: (symbol: string) => Promise<void>;
}

export function ScreenerResults({
  locale,
  loading,
  isWarmingUp,
  results,
  selectedSymbol,
  setSelectedSymbol,
  handleScreen,
  watchlistItems = [],
  onToggleWatchlist,
}: ScreenerResultsProps) {
  const [activeTab, setActiveTab] = React.useState<"results" | "watchlist">("results");

  const watchlistSymbols = React.useMemo(() => {
    return watchlistItems.map((item) => item.symbol);
  }, [watchlistItems]);

  return (
    <Card className="border-indigo-500/15 glass-indigo lg:absolute lg:inset-0 flex flex-col animate-fade-in-up delay-200 hover-premium">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
            {locale === "zh-TW" ? "合約監控板" : "Monitor Dashboard"}
          </div>
        </CardTitle>
        <div className="flex gap-1.5 p-1 bg-zinc-950/60 light:bg-slate-200/50 border border-zinc-800/40 light:border-zinc-300/60 rounded-lg mt-2">
          <button
            onClick={() => setActiveTab("results")}
            className={`flex-1 text-xs font-bold py-2 px-3 rounded-md transition-all cursor-pointer ${
              activeTab === "results"
                ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/20"
                : "text-zinc-400 light:text-zinc-600 hover:text-zinc-100 light:hover:text-zinc-800 hover:bg-zinc-800/20 light:hover:bg-slate-200"
            }`}
          >
            {locale === "zh-TW" ? `篩選結果 (${results.length})` : `Matches (${results.length})`}
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`flex-1 text-xs font-bold py-2 px-3 rounded-md transition-all cursor-pointer ${
              activeTab === "watchlist"
                ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/20"
                : "text-zinc-400 light:text-zinc-600 hover:text-zinc-100 light:hover:text-zinc-800 hover:bg-zinc-800/20 light:hover:bg-slate-200"
            }`}
          >
            {locale === "zh-TW" ? `我的追蹤 (${watchlistItems.length})` : `Watchlist (${watchlistItems.length})`}
          </button>
        </div>
        <CardDescription className="mt-2 text-xs text-zinc-500">
          {activeTab === "results"
            ? (locale === "zh-TW" ? "以 24h 成交量大小降冪排序" : "Sorted by 24h volume descending")
            : (locale === "zh-TW" ? "點擊星星取消追蹤，點選項目快速切換圖表" : "Click star to unfollow, click row to update chart")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0 gap-4 min-h-[400px]">
        {activeTab === "results" ? (
          /* 篩選結果標籤 */
          <>
            {isWarmingUp ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 border border-yellow-500/20 bg-yellow-500/5 rounded-xl text-center space-y-4">
                <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                  <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-yellow-400">
                    {locale === "zh-TW" ? "行情資料預熱中" : "Market Data Warming Up"}
                  </h4>
                  <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                    {locale === "zh-TW"
                      ? "系統剛啟動或正在重啟連線，K 線行情資料正在同步中，暫時無法完成篩選。請稍候再試，或嘗試切換至其他時框週期。"
                      : "System is warming up or fetching initial klines. Please wait or try other timeframes."}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleScreen}
                  className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 cursor-pointer"
                >
                  {locale === "zh-TW" ? "重試篩選" : "Retry Now"}
                </Button>
              </div>
            ) : loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 space-y-3">
                <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                <span className="text-xs">
                  {locale === "zh-TW" ? "指標運算與篩選中..." : "Analyzing market..."}
                </span>
              </div>
            ) : results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-center p-6 space-y-2">
                <Search className="h-8 w-8 text-zinc-600" />
                <span className="text-sm font-semibold">
                  {locale === "zh-TW" ? "無符合條件的交易對" : "No matches found"}
                </span>
                <span className="text-xs text-zinc-500 leading-normal max-w-[280px]">
                  {locale === "zh-TW"
                    ? "當前市場上沒有任何合約標的滿足您的複合均線條件。可以嘗試減少時框區塊或放寬 MA 條件。"
                    : "Try loosening your moving average conditions or reducing timeframe blocks."}
                </span>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto max-h-[400px] lg:max-h-none space-y-1.5 pr-1 border border-zinc-800/40 light:border-zinc-200/80 rounded-lg p-2 bg-zinc-950/20 light:bg-slate-100/40">
                {results.map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => setSelectedSymbol(item.symbol)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-all cursor-pointer ${
                      selectedSymbol === item.symbol
                        ? "bg-indigo-500/15 light:bg-indigo-500/10 border-indigo-500/60 light:border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.15)] light:shadow-[0_0_12px_rgba(99,102,241,0.08)]"
                        : "bg-zinc-900/30 light:bg-white border-zinc-800/40 light:border-zinc-200/80 hover:bg-zinc-900/70 light:hover:bg-zinc-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWatchlist?.(item.symbol);
                        }}
                        className="p-1 rounded hover:bg-zinc-800/40 light:hover:bg-zinc-200/50 text-zinc-500 hover:text-yellow-400 transition-colors cursor-pointer"
                        title={
                          watchlistSymbols.includes(item.symbol)
                            ? (locale === "zh-TW" ? "取消追蹤" : "Remove from watchlist")
                            : (locale === "zh-TW" ? "加入追蹤" : "Add to watchlist")
                        }
                      >
                        <Star
                          className={`h-4 w-4 transition-all ${
                            watchlistSymbols.includes(item.symbol)
                              ? "fill-yellow-500 text-yellow-500 filter drop-shadow-[0_0_4px_rgba(234,179,8,0.4)]"
                              : "text-zinc-500 hover:text-yellow-400"
                          }`}
                        />
                      </button>
                      <LineChart
                        className={`h-4.5 w-4.5 shrink-0 ${
                          selectedSymbol === item.symbol ? "text-indigo-400" : "text-zinc-500"
                        }`}
                      />
                      <span className="font-bold text-zinc-100">{item.symbol}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="font-semibold text-zinc-100">
                          $
                          {item.price.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 4,
                          })}
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                          {locale === "zh-TW" ? "最新價" : "Price"}
                        </div>
                      </div>
                      <div className="text-right min-w-[70px]">
                        <div className="font-semibold text-zinc-300">
                          ${Math.round(item.volume / 1000).toLocaleString()}K
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                          {locale === "zh-TW" ? "24h量" : "Volume"}
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          selectedSymbol === item.symbol
                            ? "text-indigo-400 translate-x-0.5"
                            : "text-zinc-600"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* 我的追蹤標籤 */
          <>
            {watchlistItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-center p-6 space-y-2">
                <Search className="h-8 w-8 text-zinc-600" />
                <span className="text-sm font-semibold">
                  {locale === "zh-TW" ? "目前尚無追蹤項目" : "No watchlist items"}
                </span>
                <span className="text-xs text-zinc-500 leading-normal max-w-[280px]">
                  {locale === "zh-TW"
                    ? "可以前往「篩選結果」點選星星圖示，快速追蹤感興趣的交易對。"
                    : "Go to the Matches tab and click the star icon to track your favorite symbols."}
                </span>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto max-h-[400px] lg:max-h-none space-y-1.5 pr-1 border border-zinc-800/40 light:border-zinc-200/80 rounded-lg p-2 bg-zinc-950/20 light:bg-slate-100/40">
                {watchlistItems.map((item) => (
                  <div
                    key={item.symbol}
                    onClick={() => setSelectedSymbol(item.symbol)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-all cursor-pointer ${
                      selectedSymbol === item.symbol
                        ? "bg-indigo-500/15 light:bg-indigo-500/10 border-indigo-500/60 light:border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.15)] light:shadow-[0_0_12px_rgba(99,102,241,0.08)]"
                        : "bg-zinc-900/30 light:bg-white border-zinc-800/40 light:border-zinc-200/80 hover:bg-zinc-900/70 light:hover:bg-zinc-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWatchlist?.(item.symbol);
                        }}
                        className="p-1 rounded hover:bg-zinc-800/40 light:hover:bg-zinc-200/50 text-yellow-500 transition-colors cursor-pointer"
                        title={locale === "zh-TW" ? "取消追蹤" : "Remove from watchlist"}
                      >
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500 filter drop-shadow-[0_0_4px_rgba(234,179,8,0.4)]" />
                      </button>
                      <LineChart
                        className={`h-4.5 w-4.5 shrink-0 ${
                          selectedSymbol === item.symbol ? "text-indigo-400" : "text-zinc-500"
                        }`}
                      />
                      <span className="font-bold text-zinc-100">{item.symbol}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="font-semibold text-zinc-100">
                          {item.price !== null && item.price !== undefined ? (
                            `$${item.price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}`
                          ) : (
                            <span className="text-zinc-500 text-xs italic">
                              {locale === "zh-TW" ? "暫無價格" : "No Price"}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                          {locale === "zh-TW" ? "價格" : "Price"}
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          selectedSymbol === item.symbol
                            ? "text-indigo-400 translate-x-0.5"
                            : "text-zinc-600"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
