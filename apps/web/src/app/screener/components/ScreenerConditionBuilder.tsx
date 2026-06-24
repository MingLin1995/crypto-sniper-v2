import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, Play, Sliders } from "lucide-react";
import { MACondition, ScreenerTimeframeBlock } from "shared";

interface ScreenerConditionBuilderProps {
  timeframes: ScreenerTimeframeBlock[];
  addTimeframeBlock: () => void;
  removeTimeframeBlock: (tfIdx: number) => void;
  updateTimeframeInterval: (tfIdx: number, interval: string) => void;
  addCondition: (tfIdx: number) => void;
  removeCondition: (tfIdx: number, condIdx: number) => void;
  updateConditionField: (
    tfIdx: number,
    condIdx: number,
    field: keyof MACondition,
    value: any
  ) => void;
  strategyName: string;
  setStrategyName: (val: string) => void;
  handleSaveStrategy: (e: React.FormEvent) => void;
  handleReset: () => void;
  handleScreen: () => void;
  loading: boolean;
  saveLoading: boolean;
  locale: string;
}

export function ScreenerConditionBuilder({
  timeframes,
  addTimeframeBlock,
  removeTimeframeBlock,
  updateTimeframeInterval,
  addCondition,
  removeCondition,
  updateConditionField,
  strategyName,
  setStrategyName,
  handleSaveStrategy,
  handleReset,
  handleScreen,
  loading,
  saveLoading,
  locale,
}: ScreenerConditionBuilderProps) {
  return (
    <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up hover-premium">
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
            className="p-4 rounded-xl border border-zinc-800/80 light:border-zinc-200 bg-zinc-900/30 light:bg-slate-50/50 space-y-4 relative group transition-all duration-300 hover:border-indigo-500/20"
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
                        updateConditionField(tfIdx, condIdx, "ma1Type", e.target.value as "SMA" | "EMA")
                      }
                      className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-200 rounded px-1.5 py-1 text-xs text-zinc-200 light:text-zinc-800 cursor-pointer"
                    >
                      <option value="EMA">EMA</option>
                      <option value="SMA">SMA</option>
                    </select>
                    <Input
                      type="number"
                      value={cond.ma1Period}
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
                      updateConditionField(tfIdx, condIdx, "operator", e.target.value as "gt" | "lt")
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
                        updateConditionField(tfIdx, condIdx, "ma2Type", e.target.value as "SMA" | "EMA")
                      }
                      className="bg-zinc-900 light:bg-white border border-zinc-800 light:border-zinc-200 rounded px-1.5 py-1 text-xs text-zinc-200 light:text-zinc-800 cursor-pointer"
                    >
                      <option value="EMA">EMA</option>
                      <option value="SMA">SMA</option>
                    </select>
                    <Input
                      type="number"
                      value={cond.ma2Period}
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
  );
}
