"use client";

import * as React from "react";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/AppProviders";
import { ThemeLanguageSelector } from "@/components/ThemeLanguageSelector";
import { Sparkles } from "lucide-react";
import { MACondition, ScreenerTimeframeBlock, SavedStrategyDto as SavedStrategy } from "shared";

import { ScreenerConditionBuilder } from "./components/ScreenerConditionBuilder";
import { StrategyManager } from "./components/StrategyManager";
import { ScreenerResults } from "./components/ScreenerResults";
import { TradingViewChart } from "./components/TradingViewChart";

interface ScreenerResultItem {
  symbol: string;
  price: number;
  volume: number;
}

const intervalOrder = ["5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w", "1M"];

function sanitizeTimeframes(blocks: ScreenerTimeframeBlock[]) {
  return blocks.map((tf) => ({
    ...tf,
    conditions: tf.conditions.map((c) => ({
      ...c,
      ma1Period: c.ma1Period === "" ? 0 : Number(c.ma1Period),
      ma2Period: c.ma2Period === "" ? 0 : Number(c.ma2Period),
    })),
  }));
}

function ScreenerContent() {
  const router = useRouter();
  const { theme, locale } = useApp();

  // 預設時框與均線條件
  const [timeframes, setTimeframes] = useState<ScreenerTimeframeBlock[]>([]);

  // 策略儲存與管理狀態
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [strategyName, setStrategyName] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);

  // 分類與拖曳狀態
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [dragOverStrategyId, setDragOverStrategyId] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  // UI 狀態
  const [results, setResults] = useState<ScreenerResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTCUSDT");

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
      const sanitizedTimeframes = sanitizeTimeframes(targetTimeframes);

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
      const sanitizedTimeframes = sanitizeTimeframes(timeframes);
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
              : "Set multi-timeframe EMA/SMA crossing conditions to scan the market."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/profile")}
            className="cursor-pointer border-indigo-500/30 hover:bg-indigo-500/10 text-zinc-200"
          >
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
        {/* 左側：篩選條件配置與我的策略清單 (7/12) */}
        <div className="lg:col-span-7 space-y-6">
          <ScreenerConditionBuilder
            timeframes={timeframes}
            addTimeframeBlock={addTimeframeBlock}
            removeTimeframeBlock={removeTimeframeBlock}
            updateTimeframeInterval={updateTimeframeInterval}
            addCondition={addCondition}
            removeCondition={removeCondition}
            updateConditionField={updateConditionField}
            strategyName={strategyName}
            setStrategyName={setStrategyName}
            handleSaveStrategy={handleSaveStrategy}
            handleReset={handleReset}
            handleScreen={handleScreen}
            loading={loading}
            saveLoading={saveLoading}
            locale={locale}
          />

          <StrategyManager
            locale={locale}
            strategies={strategies}
            customCategories={customCategories}
            groupedStrategies={groupedStrategies}
            dragOverCategory={dragOverCategory}
            dragOverStrategyId={dragOverStrategyId}
            handleLoadStrategy={handleLoadStrategy}
            handleDeleteStrategy={handleDeleteStrategy}
            handleAddCategory={handleAddCategory}
            handleDeleteCategory={handleDeleteCategory}
            handleMoveCategory={handleMoveCategory}
            handleDragStartCategory={handleDragStartCategory}
            handleDragStart={handleDragStart}
            handleDragOverStrategy={handleDragOverStrategy}
            handleDragLeaveStrategy={handleDragLeaveStrategy}
            handleDragOverCategoryContainer={handleDragOverCategoryContainer}
            handleDragLeaveCategoryContainer={handleDragLeaveCategoryContainer}
            handleDropOnCategory={handleDropOnCategory}
            handleDropOnStrategy={handleDropOnStrategy}
          />
        </div>

        {/* 右側：篩選結果 (5/12) */}
        <div className="lg:col-span-5 lg:relative">
          <ScreenerResults
            locale={locale}
            loading={loading}
            isWarmingUp={isWarmingUp}
            results={results}
            selectedSymbol={selectedSymbol}
            setSelectedSymbol={setSelectedSymbol}
            handleScreen={handleScreen}
          />
        </div>
      </div>

      {/* 下方：TradingView 高級圖表整合 */}
      <TradingViewChart
        locale={locale}
        theme={theme}
        selectedSymbol={selectedSymbol}
        timeframes={timeframes}
      />
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
