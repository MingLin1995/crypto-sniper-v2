import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Save, Play, Sliders } from 'lucide-react';
import { MACondition, ScreenerTimeframeBlock } from 'shared';

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
    value: any,
  ) => void;
  strategyName: string;
  setStrategyName: (val: string) => void;
  handleSaveStrategy: (e: React.FormEvent) => void;
  handleReset: () => void;
  handleScreen: () => void;
  loading: boolean;
  saveLoading: boolean;
  locale: string;
  editingStrategyId?: string | null;
  handleSaveAsNew?: () => void;
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
  editingStrategyId,
  handleSaveAsNew,
}: ScreenerConditionBuilderProps) {
  return (
    <Card className="border-indigo-500/15 glass-indigo animate-fade-in-up hover-premium">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-400" />
            {locale === 'zh-TW' ? '篩選條件設定' : 'Criteria Settings'}
          </CardTitle>
          <Button size="sm" onClick={addTimeframeBlock} className="cursor-pointer gap-1">
            <Plus className="h-4 w-4" />
            {locale === 'zh-TW' ? '新增時框區塊' : 'Add Timeframe'}
          </Button>
        </div>
        <CardDescription>
          {locale === 'zh-TW'
            ? '不同時間週期區塊之間為「交集 (AND)」邏輯，標的必須同時滿足所有區塊條件。'
            : 'All timeframe blocks are combined using intersection (AND) logic.'}
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
                  {locale === 'zh-TW' ? `時框區塊 #${tfIdx + 1}` : `Timeframe #${tfIdx + 1}`}
                </span>
                <select
                  value={tf.interval}
                  onChange={(e) => updateTimeframeInterval(tfIdx, e.target.value)}
                  className="bg-zinc-950 light:bg-white border border-zinc-800 light:border-zinc-200 rounded px-2.5 py-1 text-sm text-zinc-100 light:text-zinc-800 font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {['5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M'].map((i) => (
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
                  {locale === 'zh-TW' ? '增加條件' : 'Add Condition'}
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

            {/* 區塊內部的指標條件列表 */}
            <div className="space-y-3">
              {tf.conditions.map((cond, condIdx) => {
                // 解析新舊欄位以支援向後相容
                const condType = cond.type || cond.ma1Type || 'EMA';
                const condPeriod = cond.period !== undefined ? cond.period : (cond.ma1Period ?? '');
                const condMacdFast = cond.macdFast !== undefined ? cond.macdFast : 12;
                const condMacdSlow = cond.macdSlow !== undefined ? cond.macdSlow : 26;
                const condMacdSignal = cond.macdSignal !== undefined ? cond.macdSignal : 9;
                const condMacdProperty = cond.macdProperty || 'hist';

                const condCompareType = cond.compareType || 'indicator';
                const condCompareIndicatorType = cond.compareIndicatorType || cond.ma2Type || 'EMA';
                const condComparePeriod =
                  cond.comparePeriod !== undefined ? cond.comparePeriod : (cond.ma2Period ?? '');
                const condCompareMacdFast =
                  cond.compareMacdFast !== undefined ? cond.compareMacdFast : 12;
                const condCompareMacdSlow =
                  cond.compareMacdSlow !== undefined ? cond.compareMacdSlow : 26;
                const condCompareMacdSignal =
                  cond.compareMacdSignal !== undefined ? cond.compareMacdSignal : 9;
                const condCompareMacdProperty = cond.compareMacdProperty || 'hist';
                const condCompareValue = cond.compareValue !== undefined ? cond.compareValue : '';

                return (
                  <div
                    key={condIdx}
                    className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-zinc-950/60 light:bg-white border border-zinc-800/80 light:border-zinc-200 text-xs w-full shadow-sm hover:border-zinc-700 transition-colors"
                  >
                    {/* 條件序號 */}
                    <span className="text-[11px] font-bold text-indigo-400 w-5 shrink-0">
                      #{condIdx + 1}
                    </span>

                    {/* 1. 指標 A */}
                    <select
                      value={condType}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        updateConditionField(tfIdx, condIdx, 'type', val);
                        updateConditionField(tfIdx, condIdx, 'ma1Type', undefined);
                        updateConditionField(tfIdx, condIdx, 'ma1Period', undefined);
                      }}
                      className="bg-zinc-900 light:bg-slate-100 border border-zinc-700 light:border-zinc-300 rounded px-2 py-1 text-xs text-zinc-100 light:text-zinc-800 font-semibold cursor-pointer h-8 shrink-0"
                    >
                      <option value="EMA">EMA</option>
                      <option value="SMA">SMA</option>
                      <option value="MACD">MACD</option>
                      <option value="RSI">RSI</option>
                      <option value="PRICE">{locale === 'zh-TW' ? '現價 (Price)' : 'Price'}</option>
                    </select>

                    {(condType === 'EMA' ||
                      condType === 'SMA' ||
                      condType === 'RSI') && (
                      <Input
                        type="number"
                        value={condPeriod}
                        min={1}
                        max={500}
                        placeholder={locale === 'zh-TW' ? '週期' : 'Len'}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                          updateConditionField(tfIdx, condIdx, 'period', val);
                          updateConditionField(tfIdx, condIdx, 'ma1Period', val);
                        }}
                        className="w-16 h-8 text-center bg-zinc-900 light:bg-slate-100 border border-zinc-700 text-zinc-100 light:text-zinc-800 text-xs shrink-0 font-medium"
                      />
                    )}

                    {condType === 'MACD' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <select
                          value={condMacdProperty}
                          onChange={(e) =>
                            updateConditionField(tfIdx, condIdx, 'macdProperty', e.target.value)
                          }
                          className="bg-zinc-900 light:bg-slate-100 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-300 light:text-zinc-700 cursor-pointer h-8 shrink-0 font-medium"
                        >
                          <option value="macd">{locale === 'zh-TW' ? 'MACD線' : 'MACD Line'}</option>
                          <option value="signal">{locale === 'zh-TW' ? '訊號線' : 'Signal Line'}</option>
                          <option value="hist">{locale === 'zh-TW' ? '柱體' : 'Histogram'}</option>
                        </select>
                        <Input
                          type="number"
                          value={condMacdFast}
                          min={1}
                          max={500}
                          placeholder="Fast"
                          onChange={(e) =>
                            updateConditionField(tfIdx, condIdx, 'macdFast', e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                          }
                          className="w-12 h-8 text-center bg-zinc-900 light:bg-slate-100 border-zinc-700 text-xs px-1 shrink-0"
                        />
                        <Input
                          type="number"
                          value={condMacdSlow}
                          min={1}
                          max={500}
                          placeholder="Slow"
                          onChange={(e) =>
                            updateConditionField(tfIdx, condIdx, 'macdSlow', e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                          }
                          className="w-12 h-8 text-center bg-zinc-900 light:bg-slate-100 border-zinc-700 text-xs px-1 shrink-0"
                        />
                        <Input
                          type="number"
                          value={condMacdSignal}
                          min={1}
                          max={500}
                          placeholder="Sig"
                          onChange={(e) =>
                            updateConditionField(tfIdx, condIdx, 'macdSignal', e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                          }
                          className="w-10 h-8 text-center bg-zinc-900 light:bg-slate-100 border-zinc-700 text-xs px-1 shrink-0"
                        />
                      </div>
                    )}

                    {/* 2. 運算子 */}
                    <select
                      value={cond.operator}
                      onChange={(e) =>
                        updateConditionField(tfIdx, condIdx, 'operator', e.target.value as 'gt' | 'lt')
                      }
                      className="bg-zinc-900 light:bg-slate-100 border border-indigo-500/50 rounded px-2.5 py-1 h-8 text-xs font-bold text-indigo-400 light:text-indigo-600 cursor-pointer shrink-0"
                    >
                      <option value="gt">&gt; {locale === 'zh-TW' ? '大於' : 'Gt'}</option>
                      <option value="lt">&lt; {locale === 'zh-TW' ? '小於' : 'Lt'}</option>
                    </select>

                    {/* 比較模式 (指標 / 數值) */}
                    <select
                      value={condCompareType}
                      onChange={(e) => {
                        const val = e.target.value as 'indicator' | 'value';
                        updateConditionField(tfIdx, condIdx, 'compareType', val);
                        if (val === 'value') {
                          updateConditionField(tfIdx, condIdx, 'compareValue', 0);
                        } else {
                          updateConditionField(tfIdx, condIdx, 'compareIndicatorType', 'EMA');
                          updateConditionField(tfIdx, condIdx, 'comparePeriod', 60);
                        }
                      }}
                      className="bg-zinc-900 light:bg-slate-100 border border-zinc-700 rounded px-2 py-1 h-8 text-xs text-zinc-300 light:text-zinc-700 cursor-pointer font-medium shrink-0"
                    >
                      <option value="indicator">{locale === 'zh-TW' ? '指標' : 'Indicator'}</option>
                      <option value="value">{locale === 'zh-TW' ? '數值' : 'Value'}</option>
                    </select>

                    {/* 3. 指標 B 或 固定數值 */}
                    {condCompareType === 'value' ? (
                      <Input
                        type="number"
                        step="any"
                        value={condCompareValue}
                        placeholder={locale === 'zh-TW' ? '數值' : 'Value'}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                          updateConditionField(tfIdx, condIdx, 'compareValue', val);
                        }}
                        className="w-24 h-8 text-center bg-zinc-900 light:bg-slate-100 border border-zinc-700 text-zinc-100 light:text-zinc-800 text-xs shrink-0 font-bold"
                      />
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={condCompareIndicatorType}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            updateConditionField(tfIdx, condIdx, 'compareIndicatorType', val);
                            updateConditionField(tfIdx, condIdx, 'ma2Type', undefined);
                            updateConditionField(tfIdx, condIdx, 'ma2Period', undefined);
                          }}
                          className="bg-zinc-900 light:bg-slate-100 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 light:text-zinc-800 font-semibold cursor-pointer h-8 shrink-0"
                        >
                          <option value="EMA">EMA</option>
                          <option value="SMA">SMA</option>
                          <option value="PRICE">{locale === 'zh-TW' ? '現價 (Price)' : 'Price'}</option>
                          <option value="RSI">RSI</option>
                          <option value="MACD">MACD</option>
                        </select>

                        {(condCompareIndicatorType === 'EMA' ||
                          condCompareIndicatorType === 'SMA' ||
                          condCompareIndicatorType === 'RSI') && (
                          <Input
                            type="number"
                            value={condComparePeriod}
                            min={1}
                            max={500}
                            placeholder={locale === 'zh-TW' ? '週期' : 'Len'}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                              updateConditionField(tfIdx, condIdx, 'comparePeriod', val);
                              updateConditionField(tfIdx, condIdx, 'ma2Period', val);
                            }}
                            className="w-16 h-8 text-center bg-zinc-900 light:bg-slate-100 border border-zinc-700 text-zinc-100 light:text-zinc-800 text-xs shrink-0 font-medium"
                          />
                        )}

                        {condCompareIndicatorType === 'MACD' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <select
                              value={condCompareMacdProperty}
                              onChange={(e) =>
                                updateConditionField(tfIdx, condIdx, 'compareMacdProperty', e.target.value)
                              }
                              className="bg-zinc-900 light:bg-slate-100 border border-zinc-700 rounded px-1.5 py-1 text-xs text-zinc-300 light:text-zinc-700 cursor-pointer h-8 shrink-0 font-medium"
                            >
                              <option value="macd">{locale === 'zh-TW' ? 'MACD線' : 'MACD Line'}</option>
                              <option value="signal">{locale === 'zh-TW' ? '訊號線' : 'Signal Line'}</option>
                              <option value="hist">{locale === 'zh-TW' ? '柱體' : 'Histogram'}</option>
                            </select>
                            <Input
                              type="number"
                              value={condCompareMacdFast}
                              min={1}
                              max={500}
                              placeholder="Fast"
                              onChange={(e) =>
                                updateConditionField(tfIdx, condIdx, 'compareMacdFast', e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                              }
                              className="w-12 h-8 text-center bg-zinc-900 light:bg-slate-100 border-zinc-700 text-xs px-1 shrink-0"
                            />
                            <Input
                              type="number"
                              value={condCompareMacdSlow}
                              min={1}
                              max={500}
                              placeholder="Slow"
                              onChange={(e) =>
                                updateConditionField(tfIdx, condIdx, 'compareMacdSlow', e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                              }
                              className="w-12 h-8 text-center bg-zinc-900 light:bg-slate-100 border-zinc-700 text-xs px-1 shrink-0"
                            />
                            <Input
                              type="number"
                              value={condCompareMacdSignal}
                              min={1}
                              max={500}
                              placeholder="Sig"
                              onChange={(e) =>
                                updateConditionField(tfIdx, condIdx, 'compareMacdSignal', e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                              }
                              className="w-10 h-8 text-center bg-zinc-900 light:bg-slate-100 border-zinc-700 text-xs px-1 shrink-0"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* 4. 刪除按鈕 */}
                    {tf.conditions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCondition(tfIdx, condIdx)}
                        className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer p-1.5 h-8 w-8 shrink-0 ml-auto"
                        title={locale === 'zh-TW' ? '刪除條件' : 'Delete Condition'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-t border-indigo-500/10 pt-4">
        {/* 左下角：儲存與更新篩選設定 */}
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
          <form onSubmit={handleSaveStrategy} className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Input
              id="stratName"
              placeholder={locale === 'zh-TW' ? '輸入名稱以儲存策略...' : 'Enter strategy name...'}
              value={strategyName}
              onChange={(e) => setStrategyName(e.target.value)}
              className="bg-zinc-950 light:bg-white border-zinc-800 light:border-zinc-200 text-zinc-100 light:text-zinc-800 h-9 text-xs flex-1"
            />
            <Button
              type="submit"
              size="sm"
              loading={saveLoading}
              className="cursor-pointer shrink-0 h-9 text-xs"
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {editingStrategyId
                ? (locale === 'zh-TW' ? '更新此策略' : 'Update')
                : (locale === 'zh-TW' ? '儲存設定' : 'Save')}
            </Button>
          </form>
          {editingStrategyId && handleSaveAsNew && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={saveLoading}
              onClick={handleSaveAsNew}
              className="cursor-pointer shrink-0 h-9 text-xs border border-indigo-500/10 hover:bg-indigo-500/10"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {locale === 'zh-TW' ? '另存新策略' : 'Save As New'}
            </Button>
          )}
        </div>

        {/* 右下角：重設篩選與開始篩選 */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-9 text-xs cursor-pointer"
          >
            {editingStrategyId
              ? (locale === 'zh-TW' ? '取消編輯' : 'Cancel Edit')
              : (locale === 'zh-TW' ? '重設篩選' : 'Reset')}
          </Button>
          <Button
            size="sm"
            onClick={() => handleScreen()}
            loading={loading}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white cursor-pointer font-bold gap-1 h-9 text-xs"
          >
            {!loading && <Play className="h-3.5 w-3.5 fill-white" />}
            {locale === 'zh-TW' ? '開始篩選標的' : 'Run Scanner'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
