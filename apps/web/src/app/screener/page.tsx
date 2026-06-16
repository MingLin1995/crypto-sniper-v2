"use client";

import * as React from "react";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApp } from "@/components/AppProviders";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";
import {
  Play,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Sliders,
  TrendingUp,
  LineChart,
  ChevronRight,
  Sparkles,
  Search,
  BookOpen,
  GripVertical,
  ChevronUp,
  ChevronDown
} from "lucide-react";

interface MACondition {
  ma1Type: "SMA" | "EMA";
  ma1Period: number | "";
  operator: "gt" | "lt";
  ma2Type: "SMA" | "EMA";
  ma2Period: number | "";
}

interface ScreenerTimeframeBlock {
  interval: string;
  conditions: MACondition[];
}

interface ScreenerResultItem {
  symbol: string;
  price: number;
  volume: number;
}

interface SavedStrategy {
  id: string;
  name: string;
  config: {
    timeframes: ScreenerTimeframeBlock[];
    category?: string;
    sortOrder?: number;
    categories?: string[];
  };
  createdAt: string;
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

function ScreenerContent() {
  const router = useRouter();
  const { theme, locale } = useApp();

  // 預設時框與均線條件
  const [timeframes, setTimeframes] = useState<ScreenerTimeframeBlock[]>([]);
  const [chartInterval, setChartInterval] = useState<string>("D");

  // 策略儲存與管理狀態
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [strategyName, setStrategyName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  // 分類與拖曳狀態
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [dragOverStrategyId, setDragOverStrategyId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  // 計算當前可選的圖表週期（依據 timeframes 中的 interval，如果為空則預設 15m, 1h, 4h, 1d）
  const activeIntervals = React.useMemo(() => {
    const labels = timeframes.length > 0
      ? intervalOrder.filter((i) => timeframes.some((tf) => tf.interval === i))
      : ["15m", "1h", "4h", "1d"];
    return labels.map((label) => ({
      label,
      value: intervalToTradingView[label] || label,
    }));
  }, [timeframes]);

  // 依分類分組並排序儲存策略
  const groupedStrategies = React.useMemo(() => {
    const groups: Record<string, SavedStrategy[]> = {};
    const uncategorizedLabel = locale === "zh-TW" ? "未分類" : "Uncategorized";

    // 初始化分類群組
    customCategories.forEach((cat) => {
      groups[cat] = [];
    });
    groups[uncategorizedLabel] = [];

    // 排除系統內置的分類儲存策略
    const userStrategies = strategies.filter((s) => s.name !== "__categories__");

    // 依 sortOrder 排序
    const sortedStrats = [...userStrategies].sort((a, b) => {
      const orderA = a.config.sortOrder !== undefined ? Number(a.config.sortOrder) : 99999;
      const orderB = b.config.sortOrder !== undefined ? Number(b.config.sortOrder) : 99999;
      return orderA - orderB;
    });

    sortedStrats.forEach((strat) => {
      const cat = strat.config.category || uncategorizedLabel;
      let mappedCat = cat;
      // 自動跨語系對應未分類
      if (locale !== "zh-TW" && cat === "未分類") {
        mappedCat = "Uncategorized";
      } else if (locale === "zh-TW" && cat === "Uncategorized") {
        mappedCat = "未分類";
      }

      if (!groups[mappedCat]) {
        groups[mappedCat] = [];
      }
      groups[mappedCat].push(strat);
    });

    return groups;
  }, [strategies, customCategories, locale]);

  // 當可選週期變更時，若當前選擇的不在候選名單中，預設改選第一個
  useEffect(() => {
    const validValues = activeIntervals.map((item) => item.value);
    if (!validValues.includes(chartInterval)) {
      if (validValues.length > 0) {
        setChartInterval(validValues[0]);
      }
    }
  }, [activeIntervals, chartInterval]);

  // UI 狀態
  const [results, setResults] = useState<ScreenerResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTCUSDT");

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

  // 1. 取得儲存的策略列表與初始篩選
  const fetchStrategies = async () => {
    try {
      const res = await fetch("/api/strategies");
      if (res.ok) {
        const data = await res.json();
        const list: SavedStrategy[] = data.data || [];
        setStrategies(list);

        // 從資料庫載入自訂分類，優先於本地暫存以支援跨裝置同步
        const systemStrat = list.find((s) => s.name === "__categories__");
        if (
          systemStrat &&
          systemStrat.config?.categories &&
          Array.isArray(systemStrat.config.categories) &&
          systemStrat.config.categories.every((item: any) => typeof item === "string")
        ) {
          setCustomCategories(systemStrat.config.categories);
          localStorage.setItem("screener_categories", JSON.stringify(systemStrat.config.categories));
        }
      } else if (res.status === 401) {
        router.push("/login");
      }
    } catch (err) {
      console.error("Failed to fetch strategies", err);
    }
  };

  const saveCategoriesToDb = async (updatedCategories: string[]) => {
    // 尋找資料庫中是否已存在 __categories__ 設定
    const systemStrat = strategies.find((s) => s.name === "__categories__");
    try {
      if (systemStrat) {
        await fetch(`/api/strategies/${systemStrat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: {
              ...systemStrat.config,
              categories: updatedCategories,
            },
          }),
        });
      } else {
        await fetch("/api/strategies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "__categories__",
            config: {
              categories: updatedCategories,
              timeframes: [],
              sortOrder: -999,
            },
          }),
        });
      }
      // 非同步重拉以確保本地 strategies 同步
      await fetchStrategies();
    } catch (err) {
      console.error("Failed to save categories to database", err);
    }
  };

  useEffect(() => {
    fetchStrategies();
    // 首次載入自動執行預設條件篩選
    handleScreen();
  }, []);

  useEffect(() => {
    // 載入自訂分類（依語系動態初始化作為 fallback）
    const saved = localStorage.getItem("screener_categories");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          setCustomCategories(parsed);
          return;
        }
      } catch (e) {
        console.error("Failed to parse saved categories", e);
      }
    }
    setCustomCategories(locale === "zh-TW" ? ["多頭", "空頭"] : ["Long", "Short"]);
  }, [locale]);

  // 2. 執行篩選
  const handleScreen = async (overrideTimeframes?: ScreenerTimeframeBlock[]) => {
    const targetTimeframes = overrideTimeframes !== undefined ? overrideTimeframes : timeframes;
    if (targetTimeframes.length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    setIsWarmingUp(false);
    try {
      const sanitizedTimeframes = targetTimeframes.map((tf) => ({
        ...tf,
        conditions: tf.conditions.map((c) => ({
          ...c,
          ma1Period: c.ma1Period === "" ? 0 : Number(c.ma1Period),
          ma2Period: c.ma2Period === "" ? 0 : Number(c.ma2Period),
        })),
      }));

      const res = await fetch("/api/market/screener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframes: sanitizedTimeframes }),
      });

      const data = await res.json();

      if (res.status === 503) {
        setIsWarmingUp(true);
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || (locale === "zh-TW" ? "篩選失敗" : "Screening failed"));
      }

      const list: ScreenerResultItem[] = data.data || [];
      setResults(list);

      // 若有篩選結果且當前選中 symbol 不在結果中，預設選擇第一個
      if (list.length > 0) {
        const exists = list.some((item) => item.symbol === selectedSymbol);
        if (!exists) {
          setSelectedSymbol(list[0].symbol);
        }
      }
    } catch (err: any) {
      if (err.message?.includes("預熱中")) {
        setIsWarmingUp(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 重設篩選條件
  const handleReset = () => {
    setTimeframes([]);
    handleScreen([]);
  };

  // 分類與拖曳排序處理函式
  const handleAddCategory = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (customCategories.includes(trimmed) || trimmed === "未分類" || trimmed === "Uncategorized") return;
    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    localStorage.setItem("screener_categories", JSON.stringify(updated));
    saveCategoriesToDb(updated);
  };

  const handleDeleteCategory = (name: string) => {
    const confirmMsg = locale === "zh-TW" ? `確定要刪除分類「${name}」嗎？分類下的策略將移至「未分類」。` : `Delete category "${name}"? Strategies under it will move to "Uncategorized".`;
    if (!confirm(confirmMsg)) return;

    const updated = customCategories.filter((c) => c !== name);
    setCustomCategories(updated);
    localStorage.setItem("screener_categories", JSON.stringify(updated));
    saveCategoriesToDb(updated);

    // 將刪除分類下的策略歸回「未分類 / Uncategorized」
    const fallbackCategory = locale === "zh-TW" ? "未分類" : "Uncategorized";
    const stratsToReset = strategies.filter((s) => s.config.category === name);
    if (stratsToReset.length > 0) {
      (async () => {
        try {
          await Promise.all(
            stratsToReset.map(async (strat) => {
              await fetch(`/api/strategies/${strat.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  config: {
                    ...strat.config,
                    category: fallbackCategory,
                  },
                }),
              });
            })
          );
        } catch (err) {
          console.error("Failed to reset category for strategy", err);
        } finally {
          await fetchStrategies();
        }
      })();
    }
  };

  const handleMoveCategory = (name: string, direction: "up" | "down") => {
    const idx = customCategories.indexOf(name);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= customCategories.length) return;

    const updated = [...customCategories];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    setCustomCategories(updated);
    localStorage.setItem("screener_categories", JSON.stringify(updated));
    saveCategoriesToDb(updated);
  };

  const handleDragStartCategory = (e: React.DragEvent, categoryName: string) => {
    e.dataTransfer.setData("text/category", categoryName);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragStart = (e: React.DragEvent, strategyId: string) => {
    e.dataTransfer.setData("text/plain", strategyId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverStrategy = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStrategyId(id);
  };

  const handleDragLeaveStrategy = () => {
    setDragOverStrategyId(null);
  };

  const handleDragOverCategoryContainer = (e: React.DragEvent, categoryName: string) => {
    e.preventDefault();
    setDragOverCategory(categoryName);
  };

  const handleDragLeaveCategoryContainer = () => {
    setDragOverCategory(null);
  };

  const handleDropOnCategory = async (e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    setDragOverCategory(null);

    // 判斷是否為分類拖曳排序
    const categoryName = e.dataTransfer.getData("text/category");
    if (categoryName) {
      if (categoryName === targetCategory) return;
      const fromIdx = customCategories.indexOf(categoryName);
      const toIdx = customCategories.indexOf(targetCategory);
      if (fromIdx === -1 || toIdx === -1) return;

      const updated = [...customCategories];
      updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, categoryName);

      setCustomCategories(updated);
      localStorage.setItem("screener_categories", JSON.stringify(updated));
      saveCategoriesToDb(updated);
      return;
    }

    const strategyId = e.dataTransfer.getData("text/plain");
    if (!strategyId) return;

    const strategy = strategies.find((s) => s.id === strategyId);
    if (!strategy) return;

    const currentCategory = strategy.config.category || (locale === "zh-TW" ? "未分類" : "Uncategorized");
    if (currentCategory === targetCategory) return;

    // 本地即時更新
    const updated = strategies.map((s) => {
      if (s.id === strategyId) {
        return {
          ...s,
          config: {
            ...s.config,
            category: targetCategory,
          },
        };
      }
      return s;
    });
    setStrategies(updated);

    try {
      const res = await fetch(`/api/strategies/${strategyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            ...strategy.config,
            category: targetCategory,
          },
        }),
      });
      if (res.ok) {
        fetchStrategies();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDropOnStrategy = async (e: React.DragEvent, targetStrategyId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStrategyId(null);

    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetStrategyId) return;

    const draggedStrat = strategies.find((s) => s.id === draggedId);
    const targetStrat = strategies.find((s) => s.id === targetStrategyId);
    if (!draggedStrat || !targetStrat) return;

    const targetCategory = targetStrat.config.category || (locale === "zh-TW" ? "未分類" : "Uncategorized");

    // 排除系統內置的 __categories__ 策略，只對使用者策略進行排序
    const userStrategies = strategies.filter((s) => s.name !== "__categories__");
    const remaining = userStrategies.filter((s) => s.id !== draggedId);
    const insertIdx = remaining.findIndex((s) => s.id === targetStrategyId);

    const updatedDragged = {
      ...draggedStrat,
      config: {
        ...draggedStrat.config,
        category: targetCategory,
      },
    };

    const reordered = [...remaining];
    reordered.splice(insertIdx, 0, updatedDragged);

    const finalReordered = reordered.map((s, idx) => ({
      ...s,
      config: {
        ...s.config,
        sortOrder: idx,
      },
    }));

    // 保留內置的 __categories__ 策略並更新狀態
    const systemStrat = strategies.find((s) => s.name === "__categories__");
    setStrategies(systemStrat ? [systemStrat, ...finalReordered] : finalReordered);

    try {
      const savePromises = [];
      for (const strat of finalReordered) {
        const original = strategies.find((s) => s.id === strat.id);
        if (
          original &&
          (original.config.category !== strat.config.category ||
            original.config.sortOrder !== strat.config.sortOrder)
        ) {
          savePromises.push(
            fetch(`/api/strategies/${strat.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ config: strat.config }),
            })
          );
        }
      }
      await Promise.all(savePromises);
      fetchStrategies();
    } catch (err) {
      console.error(err);
    }
  };

  // 3. 儲存當前策略
  const handleSaveStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = strategyName.trim();
    if (!trimmedName) return;

    if (trimmedName === "__categories__") {
      setError(locale === "zh-TW" ? "不允許使用系統保留名稱" : "System reserved name not allowed");
      return;
    }

    setSaveLoading(true);
    setError(null);
    try {
      const sanitizedTimeframes = timeframes.map((tf) => ({
        ...tf,
        conditions: tf.conditions.map((c) => ({
          ...c,
          ma1Period: c.ma1Period === "" ? 0 : Number(c.ma1Period),
          ma2Period: c.ma2Period === "" ? 0 : Number(c.ma2Period),
        })),
      }));

      const userStrategies = strategies.filter((s) => s.name !== "__categories__");

      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          config: {
            timeframes: sanitizedTimeframes,
            category: locale === "zh-TW" ? "未分類" : "Uncategorized",
            sortOrder: userStrategies.length,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "儲存策略失敗");
      }

      setStrategyName("");
      fetchStrategies();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  // 4. 刪除策略
  const handleDeleteStrategy = async (id: string, name: string) => {
    const confirmMsg = locale === "zh-TW" ? `確定要刪除策略「${name}」嗎？` : `Delete strategy "${name}"?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/strategies/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchStrategies();
      } else {
        const data = await res.json();
        throw new Error(data.message || "刪除失敗");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // 5. 載入策略配置
  const handleLoadStrategy = (strategy: SavedStrategy) => {
    if (strategy.config && strategy.config.timeframes) {
      setTimeframes(strategy.config.timeframes);
    }
  };

  // 動態表單操作
  const addTimeframeBlock = () => {
    setTimeframes([
      ...timeframes,
      {
        interval: "1h",
        conditions: [
          {
            ma1Type: "EMA",
            ma1Period: 25,
            operator: "gt",
            ma2Type: "EMA",
            ma2Period: 60,
          },
        ],
      },
    ]);
  };

  const removeTimeframeBlock = (tfIdx: number) => {
    setTimeframes(timeframes.filter((_, i) => i !== tfIdx));
  };

  const updateTimeframeInterval = (tfIdx: number, interval: string) => {
    const updated = [...timeframes];
    updated[tfIdx].interval = interval;
    setTimeframes(updated);
  };

  const addCondition = (tfIdx: number) => {
    const updated = [...timeframes];
    updated[tfIdx].conditions.push({
      ma1Type: "EMA",
      ma1Period: 25,
      operator: "gt",
      ma2Type: "EMA",
      ma2Period: 60,
    });
    setTimeframes(updated);
  };

  const removeCondition = (tfIdx: number, condIdx: number) => {
    const updated = [...timeframes];
    updated[tfIdx].conditions = updated[tfIdx].conditions.filter((_, i) => i !== condIdx);
    setTimeframes(updated);
  };

  const updateConditionField = (
    tfIdx: number,
    condIdx: number,
    field: keyof MACondition,
    value: any
  ) => {
    const updated = [...timeframes];
    updated[tfIdx].conditions[condIdx] = {
      ...updated[tfIdx].conditions[condIdx],
      [field]: value,
    };
    setTimeframes(updated);
  };

  return (
    <div className="w-full max-w-7xl space-y-6">
      {/* 頂部標題 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-indigo-500/10 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-indigo-400 animate-pulse" />
            {locale === "zh-TW" ? "多時框均線篩選器" : "Multi-Timeframe MA Screener"}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {locale === "zh-TW"
              ? "自訂多時框 EMA/SMA 複合交叉條件，一鍵篩選全市場 USDT 永續合約標的。"
              : "Combine multiple timeframe MA cross conditions to screen all USDT perpetual futures."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/profile")} className="cursor-pointer">
            {locale === "zh-TW" ? "個人帳號設定" : "Account Settings"}
          </Button>
        </div>
      </div>

      {/* 錯誤/警告提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-sm transition-all duration-300">
          ⚠️ {error}
        </div>
      )}

      {/* 主面板網格 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 左側：篩選條件配置 (7/12) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-indigo-500/15 glass-indigo">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-indigo-400" />
                  {locale === "zh-TW" ? "篩選條件設定" : "Criteria Settings"}
                </CardTitle>
                <Button size="sm" onClick={addTimeframeBlock} className="cursor-pointer gap-1">
                  <Plus className="h-4 w-4" />
                  {locale === "zh-TW" ? "新增時框區塊" : "Add Timeframe"}
                </Button>
              </div>
              <CardDescription>
                {locale === "zh-TW"
                  ? "不同時間週期區塊之間為「交集 (AND)」邏輯，標的必須同時滿足所有區塊條件。"
                  : "All timeframe blocks are combined using intersection (AND) logic."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {timeframes.map((tf, tfIdx) => (
                <div
                  key={tfIdx}
                  className="p-4 rounded-xl border border-zinc-800/80 light:border-zinc-200 bg-zinc-900/30 light:bg-slate-50/50 space-y-4 relative group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-indigo-500/15 text-indigo-400 text-xs font-bold uppercase border border-indigo-500/20">
                        {locale === "zh-TW" ? `時框區塊 #${tfIdx + 1}` : `Timeframe #${tfIdx + 1}`}
                      </span>
                      <select
                        value={tf.interval}
                        onChange={(e) => updateTimeframeInterval(tfIdx, e.target.value)}
                        className="bg-zinc-950 light:bg-white border border-zinc-800 light:border-zinc-200 rounded px-2.5 py-1 text-sm text-zinc-100 light:text-zinc-800 font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        {["5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1M"].map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addCondition(tfIdx)}
                        className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer gap-1 text-xs"
                      >
                        <Plus className="h-3 w-3" />
                        {locale === "zh-TW" ? "增加條件" : "Add Condition"}
                      </Button>
                      {timeframes.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTimeframeBlock(tfIdx)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 區塊內部的均線條件列表 */}
                  <div className="space-y-3">
                    {tf.conditions.map((cond, condIdx) => (
                      <div
                        key={condIdx}
                        className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded bg-zinc-950/40 light:bg-white border border-zinc-800/40 light:border-zinc-200 text-sm"
                      >
                        {/* MA 1 */}
                        <div className="flex items-center gap-1.5 min-w-[120px] flex-1">
                          <select
                            value={cond.ma1Type}
                            onChange={(e) =>
                              updateConditionField(tfIdx, condIdx, "ma1Type", e.target.value)
                            }
                            className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-200 rounded px-1.5 py-1 text-xs text-zinc-200 light:text-zinc-800 cursor-pointer"
                          >
                            <option value="EMA">EMA</option>
                            <option value="SMA">SMA</option>
                          </select>
                          <Input
                            type="number"
                            value={cond.ma1Period || ""}
                            min={1}
                            placeholder="MA"
                            onChange={(e) =>
                              updateConditionField(
                                tfIdx,
                                condIdx,
                                "ma1Period",
                                e.target.value === "" ? "" : (parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-16 h-8 text-center bg-zinc-900 light:bg-white border-zinc-800 light:border-zinc-200 text-zinc-100 light:text-zinc-800 text-xs"
                          />
                        </div>

                        {/* Operator */}
                        <select
                          value={cond.operator}
                          onChange={(e) =>
                            updateConditionField(tfIdx, condIdx, "operator", e.target.value)
                          }
                          className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-200 rounded px-2 py-1 text-xs font-semibold text-indigo-400 light:text-indigo-600 cursor-pointer"
                        >
                          <option value="gt">大於 &gt;</option>
                          <option value="lt">小於 &lt;</option>
                        </select>

                        {/* MA 2 */}
                        <div className="flex items-center gap-1.5 min-w-[120px] flex-1">
                          <select
                            value={cond.ma2Type}
                            onChange={(e) =>
                              updateConditionField(tfIdx, condIdx, "ma2Type", e.target.value)
                            }
                            className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-200 rounded px-1.5 py-1 text-xs text-zinc-200 light:text-zinc-800 cursor-pointer"
                          >
                            <option value="EMA">EMA</option>
                            <option value="SMA">SMA</option>
                          </select>
                          <Input
                            type="number"
                            value={cond.ma2Period || ""}
                            min={1}
                            placeholder="MA"
                            onChange={(e) =>
                              updateConditionField(
                                tfIdx,
                                condIdx,
                                "ma2Period",
                                e.target.value === "" ? "" : (parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-16 h-8 text-center bg-zinc-900 light:bg-white border-zinc-800 light:border-zinc-200 text-zinc-100 light:text-zinc-800 text-xs"
                          />
                        </div>

                        {/* 刪除條件 */}
                        {tf.conditions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCondition(tfIdx, condIdx)}
                            className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer p-1 h-8 w-8"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-t border-indigo-500/10 pt-4">
              {/* 左下角：儲存篩選設定 */}
              <form onSubmit={handleSaveStrategy} className="flex items-center gap-2 flex-1 max-w-md">
                <Input
                  id="stratName"
                  placeholder={locale === "zh-TW" ? "輸入名稱以儲存策略..." : "Enter strategy name..."}
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  className="bg-zinc-950 light:bg-white border-zinc-800 light:border-zinc-200 text-zinc-100 light:text-zinc-800 h-9 text-xs flex-1"
                />
                <Button type="submit" size="sm" loading={saveLoading} className="cursor-pointer shrink-0 h-9 text-xs">
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {locale === "zh-TW" ? "儲存設定" : "Save"}
                </Button>
              </form>

              {/* 右下角：重設篩選與開始篩選 */}
              <div className="flex items-center gap-2 shrink-0 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="h-9 text-xs cursor-pointer"
                >
                  {locale === "zh-TW" ? "重設篩選" : "Reset"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleScreen()}
                  loading={loading}
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white cursor-pointer font-bold gap-1 h-9 text-xs"
                >
                  {!loading && <Play className="h-3.5 w-3.5 fill-white" />}
                  {locale === "zh-TW" ? "開始篩選標的" : "Run Scanner"}
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* 我的策略清單 Card */}
          <Card className="border-indigo-500/15 glass-indigo">
            <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-400" />
                  {locale === "zh-TW" ? "我的策略清單" : "Saved Strategies"}
                </CardTitle>
                <CardDescription>
                  {locale === "zh-TW"
                    ? "支援分類管理與拖曳排序。拖曳策略可變更分類或調整順序。"
                    : "Supports category grouping and drag-and-drop reordering."}
                </CardDescription>
              </div>

              {/* 新增分類 Form */}
              <div className="flex items-center gap-2 max-w-xs w-full sm:w-auto">
                <Input
                  placeholder={locale === "zh-TW" ? "新增分類名稱..." : "New category..."}
                  id="newCategoryName"
                  className="h-8 text-xs bg-zinc-950 light:bg-white border-zinc-800 light:border-zinc-200 text-zinc-100 light:text-zinc-800"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value;
                      handleAddCategory(val);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs cursor-pointer shrink-0"
                  onClick={() => {
                    const input = document.getElementById("newCategoryName") as HTMLInputElement;
                    if (input) {
                      handleAddCategory(input.value);
                      input.value = "";
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4 max-h-[400px] overflow-y-auto">
              {Object.keys(groupedStrategies).map((catName) => {
                const strats = groupedStrategies[catName];
                const isUncategorized = catName === "未分類" || catName === "Uncategorized";
                if (isUncategorized && strats.length === 0) return null;

                const isOver = dragOverCategory === catName;

                return (
                  <div
                    key={catName}
                    onDragOver={(e) => handleDragOverCategoryContainer(e, catName)}
                    onDragLeave={handleDragLeaveCategoryContainer}
                    onDrop={(e) => handleDropOnCategory(e, catName)}
                    className={`p-3 rounded-xl border transition-all duration-200 ${
                      isOver
                        ? "bg-indigo-500/10 border-indigo-500/50 shadow-md"
                        : "bg-zinc-900/20 light:bg-slate-100/30 border-zinc-800/40 light:border-zinc-200/60"
                    }`}
                  >
                    {/* 分類標題 */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60 light:border-zinc-200/60">
                      <span
                        className={`text-xs font-bold text-indigo-400 light:text-indigo-600 flex items-center gap-1.5 ${
                          !isUncategorized ? "cursor-grab active:cursor-grabbing select-none" : ""
                        }`}
                        draggable={!isUncategorized}
                        onDragStart={(e) => !isUncategorized && handleDragStartCategory(e, catName)}
                      >
                        {!isUncategorized && <GripVertical className="h-3.5 w-3.5 text-indigo-400/70" />}
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        {catName} ({strats.length})
                      </span>
                      {!isUncategorized && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={customCategories.indexOf(catName) === 0}
                            onClick={() => handleMoveCategory(catName, "up")}
                            className="text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 h-5 w-5 p-0 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                            title={locale === "zh-TW" ? "上移分類" : "Move up"}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={customCategories.indexOf(catName) === customCategories.length - 1}
                            onClick={() => handleMoveCategory(catName, "down")}
                            className="text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 h-5 w-5 p-0 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                            title={locale === "zh-TW" ? "下移分類" : "Move down"}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(catName)}
                            className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-5 w-5 p-0 cursor-pointer"
                            title={locale === "zh-TW" ? "刪除此分類" : "Delete category"}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* 策略列表 */}
                    <div className="space-y-1.5 min-h-[40px] transition-colors duration-150">
                      {strats.length === 0 ? (
                        <div className="text-center py-2 text-[10px] text-zinc-500 italic">
                          {locale === "zh-TW" ? "拖曳策略至此分類" : "Drag strategies here"}
                        </div>
                      ) : (
                        strats.map((strat) => {
                          const isDragOverThis = dragOverStrategyId === strat.id;
                          return (
                            <div
                              key={strat.id}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, strat.id)}
                              onDragOver={(e) => handleDragOverStrategy(e, strat.id)}
                              onDragLeave={handleDragLeaveStrategy}
                              onDrop={(e) => handleDropOnStrategy(e, strat.id)}
                              className={`flex items-center justify-between p-2 rounded bg-zinc-900/40 light:bg-white hover:bg-zinc-900/80 light:hover:bg-zinc-50 border transition-all duration-150 ${
                                isDragOverThis
                                  ? "border-t-2 border-t-indigo-500 border-zinc-800 light:border-zinc-200"
                                  : "border-zinc-800/40 light:border-zinc-200"
                              }`}
                              style={{ cursor: "grab" }}
                            >
                              <button
                                onClick={() => handleLoadStrategy(strat)}
                                className="font-medium text-left truncate flex-1 hover:text-indigo-400 cursor-pointer text-xs text-zinc-200 light:text-zinc-800 flex items-center gap-1.5"
                              >
                                <GripVertical className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                {strat.name}
                              </button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteStrategy(strat.id, strat.name)}
                                className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 cursor-pointer h-6 w-6 p-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* 右側：篩選結果與圖表整合 (5/12) */}
        <div className="lg:col-span-5 lg:relative">
          <Card className="border-indigo-500/15 glass-indigo lg:absolute lg:inset-0 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-400" />
                  {locale === "zh-TW" ? "篩選匹配結果" : "Matches"}
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">
                  {results.length} {locale === "zh-TW" ? "符合" : "Matches"}
                </span>
              </CardTitle>
              <CardDescription>
                {locale === "zh-TW" ? "以 24h 成交量大小降冪排序" : "Sorted by 24h volume descending"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-4 pt-0 gap-4 min-h-[400px]">
              
              {/* 預熱中狀態提示 */}
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
                  <Button size="sm" variant="outline" onClick={() => handleScreen()} className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 cursor-pointer">
                    {locale === "zh-TW" ? "重試篩選" : "Retry Now"}
                  </Button>
                </div>
              ) : loading ? (
                // 載入狀態
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 space-y-3">
                  <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
                  <span className="text-xs">{locale === "zh-TW" ? "指標運算與篩選中..." : "Analyzing market..."}</span>
                </div>
              ) : results.length === 0 ? (
                // 無結果
                <div className="flex-1 flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-center p-6 space-y-2">
                  <Search className="h-8 w-8 text-zinc-600" />
                  <span className="text-sm font-semibold">{locale === "zh-TW" ? "無符合條件的交易對" : "No matches found"}</span>
                  <span className="text-xs text-zinc-500 leading-normal max-w-[280px]">
                    {locale === "zh-TW"
                      ? "當前市場上沒有任何合約標的滿足您的複合均線條件。可以嘗試減少時框區塊或放寬 MA 條件。"
                      : "Try loosening your moving average conditions or reducing timeframe blocks."}
                  </span>
                </div>
              ) : (
                // 結果清單
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
                        <LineChart className={`h-4.5 w-4.5 shrink-0 ${selectedSymbol === item.symbol ? "text-indigo-400" : "text-zinc-500"}`} />
                        <span className="font-bold text-zinc-100">{item.symbol}</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="font-semibold text-zinc-100">${item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{locale === "zh-TW" ? "最新價" : "Price"}</div>
                        </div>
                        <div className="text-right min-w-[70px]">
                          <div className="font-semibold text-zinc-300">
                            ${Math.round(item.volume / 1000).toLocaleString()}K
                          </div>
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{locale === "zh-TW" ? "24h量" : "Volume"}</div>
                        </div>
                        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${selectedSymbol === item.symbol ? "text-indigo-400 translate-x-0.5" : "text-zinc-600"}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* 下方：TradingView 高級圖表整合 */}
      <Card className="border-indigo-500/15 glass-indigo">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <LineChart className="h-5 w-5 text-indigo-400" />
              {locale === "zh-TW" ? `TradingView 高級圖表 - ${selectedSymbol}` : `TradingView Chart - ${selectedSymbol}`}
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
                      className={`text-xs font-semibold px-3 py-1 rounded-md transition-all cursor-pointer ${
                        chartInterval === item.value
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
    </div>
  );
}

export default function ScreenerPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 bg-zinc-950/60 min-h-screen">
      <ThemeLanguageSelector />
      <Suspense fallback={<div className="text-zinc-500 text-sm">載入中...</div>}>
        <ScreenerContent />
      </Suspense>
    </main>
  );
}
