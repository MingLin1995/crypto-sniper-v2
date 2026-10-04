'use client';

import * as React from 'react';
import {
  Settings,
  Play,
  Activity,
  AlertTriangle,
  ShieldAlert,
  Target,
  Zap,
  SlidersHorizontal,
  CheckCircle2,
  Plus,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MACondition } from 'shared';

export interface SavedStrategy {
  id: string;
  name: string;
  config: any;
}

export interface BacktestConfigFormProps {
  locale: string;
  watchlist: string[];
  strategies: SavedStrategy[];
  selectedStrategyId: string;
  setSelectedStrategyId: (id: string) => void;
  selectedSymbols: string[];
  setSelectedSymbols: (syms: string[]) => void;
  symbolText: string;
  setSymbolText: (txt: string) => void;
  interval: string;
  setInterval: (val: string) => void;
  leverage: number;
  setLeverage: (val: number) => void;

  // Simple Risk & Exit
  slPercent: number;
  setSlPercent: (val: number) => void;
  useTpFixed: boolean;
  setUseTpFixed: (val: boolean) => void;
  tpPercent: number;
  setTpPercent: (val: number) => void;
  exitConditionMode: 'AUTO_REVERSE' | 'CUSTOM' | 'NONE';
  setExitConditionMode: (mode: 'AUTO_REVERSE' | 'CUSTOM' | 'NONE') => void;
  exitConditions: MACondition[];
  setExitConditions: (conds: MACondition[]) => void;

  // Account & Sizing
  initialBalance: number;
  setInitialBalance: (val: number) => void;
  positionSizingMode: 'FIXED_PERCENT' | 'RISK_BASED';
  setPositionSizingMode: (mode: 'FIXED_PERCENT' | 'RISK_BASED') => void;
  fixedMarginPercent: number;
  setFixedMarginPercent: (val: number) => void;
  riskPercentPerTrade: number;
  setRiskPercentPerTrade: (val: number) => void;
  maxPositions: number;
  setMaxPositions: (val: number) => void;
  startDateStr: string;
  setStartDateStr: (val: string) => void;
  endDateStr: string;
  setEndDateStr: (val: string) => void;
  onStartBacktest: () => void;
}

export function BacktestConfigForm({
  locale,
  watchlist,
  strategies,
  selectedStrategyId,
  setSelectedStrategyId,
  selectedSymbols,
  setSelectedSymbols,
  symbolText,
  setSymbolText,
  interval,
  setInterval,
  leverage,
  setLeverage,
  slPercent,
  setSlPercent,
  useTpFixed,
  setUseTpFixed,
  tpPercent,
  setTpPercent,
  exitConditionMode,
  setExitConditionMode,
  exitConditions,
  setExitConditions,
  initialBalance,
  setInitialBalance,
  positionSizingMode,
  setPositionSizingMode,
  fixedMarginPercent,
  setFixedMarginPercent,
  riskPercentPerTrade,
  setRiskPercentPerTrade,
  maxPositions,
  setMaxPositions,
  startDateStr,
  setStartDateStr,
  endDateStr,
  setEndDateStr,
  onStartBacktest,
}: BacktestConfigFormProps) {
  const intervalOrder = ['5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M'];
  const [showWatchlist, setShowWatchlist] = React.useState(false);

  const findMainInterval = (timeframes: any[]): string => {
    if (!timeframes || timeframes.length === 0) return '15m';
    const sorted = [...timeframes].sort((a, b) => {
      const idxA = intervalOrder.indexOf(a.interval);
      const idxB = intervalOrder.indexOf(b.interval);
      return idxA - idxB;
    });
    return sorted[0].interval;
  };

  const isDateRangeTooLong = React.useMemo(() => {
    if (!startDateStr || !endDateStr) return false;
    const start = new Date(startDateStr).getTime();
    const end = new Date(endDateStr).getTime();
    if (isNaN(start) || isNaN(end)) return false;
    const fiveYearsMs = 5 * 365.25 * 24 * 60 * 60 * 1000;
    return end - start > fiveYearsMs;
  }, [startDateStr, endDateStr]);

  const handleStrategyChange = (strategyId: string) => {
    setSelectedStrategyId(strategyId);
    if (!strategyId) return;

    const strat = strategies.find((s) => s.id === strategyId);
    if (!strat || !strat.config) return;

    const mainInterval = findMainInterval(strat.config.timeframes);
    setInterval(mainInterval);

    if (strat.config.leverage) setLeverage(strat.config.leverage);
    if (strat.config.slPercent) setSlPercent(strat.config.slPercent);

    if (strat.config.exitConditionMode === 'CUSTOM' || strat.config.exitConditionMode === 'AUTO_REVERSE') {
      setExitConditionMode(strat.config.exitConditionMode);
      setUseTpFixed(false);
    } else if (strat.config.useTpFixed || strat.config.exitConditionMode === 'NONE' || (strat.config.tpPercent && strat.config.tpPercent > 0)) {
      if (strat.config.tpPercent) setTpPercent(strat.config.tpPercent);
      setUseTpFixed(true);
      setExitConditionMode('NONE');
    } else {
      setExitConditionMode('AUTO_REVERSE');
      setUseTpFixed(false);
    }

    if (strat.config.exitConditions && Array.isArray(strat.config.exitConditions) && strat.config.exitConditions.length > 0) {
      setExitConditions(strat.config.exitConditions);
    }

    if (strat.config.symbols && Array.isArray(strat.config.symbols) && strat.config.symbols.length > 0) {
      setSelectedSymbols(strat.config.symbols.slice(0, 10));
    }

    if (strat.config.positionSizingMode) {
      setPositionSizingMode(strat.config.positionSizingMode);
    }
    if (strat.config.riskPercentPerTrade) {
      setRiskPercentPerTrade(strat.config.riskPercentPerTrade);
    }
    if (strat.config.fixedMarginPercent) {
      setFixedMarginPercent(strat.config.fixedMarginPercent);
    }
  };

  const selectedStrategy = React.useMemo(() => {
    return strategies.find((s) => s.id === selectedStrategyId);
  }, [strategies, selectedStrategyId]);

  const derivedAutoReversePreview = React.useMemo(() => {
    if (!selectedStrategy || !selectedStrategy.config?.timeframes) {
      return locale === 'zh-TW'
        ? `依 ${interval} 主時框指標方向反向時市價平倉`
        : `Exit on ${interval} timeframe indicator reversal`;
    }
    const tfs: any[] = selectedStrategy.config.timeframes;
    const block = tfs.find((tf: any) => tf.interval === interval) || tfs[0];
    if (!block || !block.conditions || block.conditions.length === 0) {
      return locale === 'zh-TW'
        ? `依 ${interval} 主時框指標方向反向時市價平倉`
        : `Exit on ${interval} timeframe indicator reversal`;
    }

    const cond = block.conditions[0];
    const leftType = cond.type || cond.ma1Type || 'EMA';
    const leftPeriod = cond.period !== undefined ? cond.period : cond.ma1Period;
    const formatInd = (t: string, p: any, macdProp?: string) => {
      if (t === 'PRICE') return locale === 'zh-TW' ? '現價' : 'Price';
      if (t === 'MACD') return `MACD (${macdProp || 'hist'})`;
      return `${t}(${p ?? 20})`;
    };
    const leftText = `${block.interval} ${formatInd(leftType, leftPeriod, cond.macdProperty)}`;
    const reversedOp = cond.operator === 'gt' ? '< (死叉 / 跌破)' : '> (金叉 / 突破)';

    let rightText = '';
    if (cond.compareType === 'value') {
      rightText = `${cond.compareValue ?? 0}`;
    } else {
      const rightType = cond.compareIndicatorType || cond.ma2Type || 'EMA';
      const rightPeriod = cond.comparePeriod !== undefined ? cond.comparePeriod : cond.ma2Period;
      rightText = `${block.interval} ${formatInd(rightType, rightPeriod, cond.compareMacdProperty)}`;
    }

    return `${leftText} ${reversedOp} ${rightText}`;
  }, [selectedStrategy, interval, locale]);

  const updateExitConditionField = (condIdx: number, field: keyof MACondition, value: any) => {
    const updated = [...exitConditions];
    updated[condIdx] = {
      ...updated[condIdx],
      [field]: value,
    };
    setExitConditions(updated);
  };

  const addExitCondition = () => {
    setExitConditions([
      ...exitConditions,
      {
        type: 'PRICE',
        operator: 'lt',
        compareType: 'indicator',
        compareIndicatorType: 'EMA',
        comparePeriod: 20,
      },
    ]);
  };

  const removeExitCondition = (condIdx: number) => {
    if (exitConditions.length <= 1) return;
    setExitConditions(exitConditions.filter((_, idx) => idx !== condIdx));
  };

  const handleSymbolInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cleanText = symbolText.trim().toUpperCase();
      if (cleanText) {
        if (selectedSymbols.includes(cleanText)) return;
        if (selectedSymbols.length >= 10) {
          alert(locale === 'zh-TW' ? '最多只能選擇 10 個交易對' : 'Max 10 symbols allowed');
          return;
        }
        setSelectedSymbols([...selectedSymbols, cleanText]);
        setSymbolText('');
      }
    }
  };

  const removeSymbol = (sym: string) => {
    setSelectedSymbols(selectedSymbols.filter((s) => s !== sym));
  };

  const addAllWatchlist = () => {
    const combined = Array.from(new Set([...selectedSymbols, ...watchlist])).slice(0, 10);
    setSelectedSymbols(combined);
  };

  return (
    <Card className="border border-zinc-800 bg-zinc-950/70 backdrop-blur-md shadow-xl text-zinc-100">
      <CardHeader className="border-b border-zinc-800/80 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-zinc-100">
              <Settings className="w-5 h-5 text-indigo-400" />
              {locale === 'zh-TW' ? '回測參數配置' : 'Backtest Configuration'}
            </CardTitle>
          </div>
          <Button
            data-testid="backtest-start-btn"
            onClick={onStartBacktest}
            disabled={!selectedStrategyId || selectedSymbols.length === 0 || isDateRangeTooLong}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2 h-9 rounded-lg shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            <Play className="w-4 h-4 mr-1.5 fill-current" />
            {locale === 'zh-TW' ? '開始回測' : 'Start Backtest'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* 1. 選擇策略與標的 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">
              {locale === 'zh-TW' ? '選擇已儲存之篩選策略' : 'Select Saved Strategy'}
            </label>
            <select
              data-testid="backtest-strategy-select"
              value={selectedStrategyId}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-zinc-100 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="">{locale === 'zh-TW' ? '-- 請選擇策略 --' : '-- Select Strategy --'}</option>
              {strategies.map((strat) => (
                <option key={strat.id} value={strat.id}>
                  {strat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">
                {locale === 'zh-TW' ? '回測標的 (可單選或最多 10 個)' : 'Symbols (1 ~ 10)'}
              </label>
              <div className="flex items-center gap-2">
                {selectedSymbols.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSymbols([])}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {locale === 'zh-TW' ? '清空' : 'Clear'}
                  </button>
                )}
                {watchlist.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowWatchlist(!showWatchlist)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    {showWatchlist
                      ? (locale === 'zh-TW' ? '收起追蹤清單' : 'Hide Watchlist')
                      : (locale === 'zh-TW' ? '載入追蹤清單' : 'Load Watchlist')}
                  </button>
                )}
              </div>
            </div>

            <Input
              type="text"
              data-testid="backtest-symbol-input"
              value={symbolText}
              onChange={(e) => setSymbolText(e.target.value)}
              onKeyDown={handleSymbolInputKeyDown}
              placeholder={locale === 'zh-TW' ? '輸入標的 (如 BTCUSDT) 後按 Enter' : 'Type symbol and hit Enter'}
              className="h-9 bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
            />

            {/* 展開之追蹤清單點選區 */}
            {showWatchlist && watchlist.length > 0 && (
              <div className="p-2.5 rounded-lg bg-zinc-900/90 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{locale === 'zh-TW' ? '點擊加入 / 移除標的：' : 'Click to add / remove symbol:'}</span>
                  <button
                    type="button"
                    onClick={addAllWatchlist}
                    className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    {locale === 'zh-TW' ? '全部加入' : 'Add All'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {watchlist.map((sym) => {
                    const isSelected = selectedSymbols.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSymbols(selectedSymbols.filter((s) => s !== sym));
                          } else {
                            if (selectedSymbols.length >= 10) {
                              alert(locale === 'zh-TW' ? '最多只能選擇 10 個交易對' : 'Max 10 symbols allowed');
                              return;
                            }
                            setSelectedSymbols([...selectedSymbols, sym]);
                          }
                        }}
                        className={`px-2.5 py-1 text-xs rounded-md font-mono transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 font-semibold shadow-sm'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                        }`}
                      >
                        {isSelected ? `✓ ${sym}` : `+ ${sym}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {selectedSymbols.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedSymbols.map((sym) => (
                  <span
                    key={sym}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-200 border border-zinc-700"
                  >
                    {sym}
                    <button
                      type="button"
                      onClick={() => removeSymbol(sym)}
                      className="text-zinc-400 hover:text-red-400 text-xs ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. 回測時間區間與主要時框 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              {locale === 'zh-TW' ? '主要執行時框' : 'Execution Interval'}
            </label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="w-full h-8 bg-zinc-900 border border-zinc-800 rounded px-2 text-zinc-100 text-xs"
            >
              {intervalOrder.map((intv) => (
                <option key={intv} value={intv}>
                  {intv}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              {locale === 'zh-TW' ? '開始日期' : 'Start Date'}
            </label>
            <Input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="h-8 bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">
              {locale === 'zh-TW' ? '結束日期' : 'End Date'}
            </label>
            <Input
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="h-8 bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
            />
          </div>
        </div>

        {isDateRangeTooLong && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{locale === 'zh-TW' ? '回測時間跨度不得超過 5 年 (1825 天)。' : 'Backtest range cannot exceed 5 years.'}</span>
          </div>
        )}

        {/* 3. 風險控制與出場策略 (雙模式平倉機制) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3.5 bg-indigo-500 rounded-full" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              {locale === 'zh-TW' ? '風險控制與出場機制' : 'Risk & Exit Management'}
            </h3>
          </div>

          {/* 上半部：固定停損 (Stop Loss) 與 固定目標停利 (Take Profit) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 固定停損 */}
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" />
                  {locale === 'zh-TW' ? '固定停損 (Stop Loss)' : 'Fixed Stop Loss'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-mono font-bold">
                  -{slPercent}%
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-zinc-300 font-medium whitespace-nowrap">
                  {locale === 'zh-TW' ? '停損幅度 (%):' : 'Stop Loss (%):'}
                </span>
                <Input
                  type="number"
                  value={slPercent}
                  onChange={(e) => setSlPercent(Number(e.target.value))}
                  step={0.5}
                  min={0.1}
                  max={100}
                  className="bg-zinc-900 border-red-500/30 text-zinc-100 font-bold text-sm h-8"
                />
              </div>
            </div>

            {/* 固定目標停利 */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Target className="w-4 h-4" />
                  {locale === 'zh-TW' ? '固定停利 (Take Profit)' : 'Fixed Take Profit'}
                </span>
                <input
                  type="checkbox"
                  checked={useTpFixed}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseTpFixed(checked);
                    if (checked) {
                      setExitConditionMode('NONE');
                    } else {
                      setExitConditionMode('AUTO_REVERSE');
                    }
                  }}
                  className="h-4 w-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
              {useTpFixed ? (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-zinc-300 font-medium whitespace-nowrap">
                    {locale === 'zh-TW' ? '目標獲利 (%):' : 'Target Profit (%):'}
                  </span>
                  <Input
                    type="number"
                    value={tpPercent}
                    onChange={(e) => setTpPercent(Number(e.target.value))}
                    step={1}
                    min={0.5}
                    max={500}
                    className="bg-zinc-900 border-emerald-500/30 text-zinc-100 font-bold text-sm h-8"
                  />
                </div>
              ) : (
                <div className="text-[11px] text-zinc-500 italic pt-2">
                  {locale === 'zh-TW' ? '（已改用下方指標平倉）' : '(Using signal exit below)'}
                </div>
              )}
            </div>
          </div>

          {/* 下半部：指標平倉模式 (雙模式：反向平倉 vs 自訂平倉條件) */}
          <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-indigo-400" />
                {locale === 'zh-TW' ? '指標出場訊號' : 'Indicator Signal Exit'}
              </div>

              {/* 2 模式切換鈕：反向平倉 vs 自訂平倉條件 */}
              <div className="flex items-center bg-zinc-900/90 border border-zinc-800 rounded-lg p-1 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setExitConditionMode('AUTO_REVERSE');
                    if (useTpFixed) setUseTpFixed(false);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                    exitConditionMode === 'AUTO_REVERSE'
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {locale === 'zh-TW' ? '反向平倉' : 'Reverse Exit'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExitConditionMode('CUSTOM');
                    if (useTpFixed) setUseTpFixed(false);
                  }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                    exitConditionMode === 'CUSTOM'
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {locale === 'zh-TW' ? '自訂平倉條件' : 'Custom Exit'}
                </button>
              </div>
            </div>

            {/* Mode 1: AUTO_REVERSE */}
            {exitConditionMode === 'AUTO_REVERSE' && (
              <div className="p-3 bg-zinc-900/70 border border-indigo-500/20 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {locale === 'zh-TW' ? '反向平倉已啟用' : 'Reverse Exit Enabled'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">
                    {interval} 時框
                  </span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-black/40 border border-zinc-800 text-xs font-mono text-indigo-300">
                  <span className="text-zinc-400 font-sans text-[11px] shrink-0">
                    {locale === 'zh-TW' ? '平倉條件：' : 'Exit Condition:'}
                  </span>
                  <span className="font-bold text-emerald-300 truncate">
                    {derivedAutoReversePreview}
                  </span>
                </div>
              </div>
            )}

            {/* Mode 2: CUSTOM */}
            {exitConditionMode === 'CUSTOM' && (
              <div className="space-y-3 p-3 bg-zinc-900/70 border border-indigo-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                    {locale === 'zh-TW' ? '自訂平倉條件' : 'Custom Exit Conditions'}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExitCondition}
                    className="h-6 text-[11px] px-2 border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {locale === 'zh-TW' ? '新增條件' : 'Add Condition'}
                  </Button>
                </div>

                <div className="space-y-2">
                  {exitConditions.map((cond, condIdx) => {
                    const condType = cond.type || 'PRICE';
                    const condPeriod = cond.period !== undefined ? cond.period : 20;
                    const condCompareType = cond.compareType || 'indicator';
                    const condCompareIndicatorType = cond.compareIndicatorType || 'EMA';
                    const condComparePeriod = cond.comparePeriod !== undefined ? cond.comparePeriod : 20;
                    const condCompareValue = cond.compareValue !== undefined ? cond.compareValue : 0;

                    return (
                      <div
                        key={condIdx}
                        className="flex flex-wrap items-center gap-2 p-2 bg-zinc-950/80 border border-zinc-800 rounded-lg text-xs"
                      >
                        <span className="text-[11px] font-bold text-indigo-400 w-4">
                          #{condIdx + 1}
                        </span>

                        {/* 指標 1 */}
                        <select
                          value={condType}
                          onChange={(e) => updateExitConditionField(condIdx, 'type', e.target.value)}
                          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-medium h-7 cursor-pointer"
                        >
                          <option value="PRICE">{locale === 'zh-TW' ? '現價 (Price)' : 'Price'}</option>
                          <option value="EMA">EMA</option>
                          <option value="SMA">SMA</option>
                          <option value="RSI">RSI</option>
                          <option value="MACD">MACD</option>
                        </select>

                        {condType !== 'PRICE' && condType !== 'MACD' && (
                          <Input
                            type="number"
                            value={condPeriod}
                            min={1}
                            max={500}
                            placeholder="週期"
                            onChange={(e) => updateExitConditionField(condIdx, 'period', Number(e.target.value))}
                            className="w-16 h-7 text-center bg-zinc-900 border-zinc-700 text-xs"
                          />
                        )}

                        {/* 運算子 */}
                        <select
                          value={cond.operator}
                          onChange={(e) => updateExitConditionField(condIdx, 'operator', e.target.value as any)}
                          className="bg-zinc-900 border border-indigo-500/50 rounded px-2 py-1 text-xs text-indigo-300 font-bold h-7 cursor-pointer"
                        >
                          <option value="gt">&gt; {locale === 'zh-TW' ? '大於' : 'Gt'}</option>
                          <option value="lt">&lt; {locale === 'zh-TW' ? '小於' : 'Lt'}</option>
                        </select>

                        {/* 比較模式 */}
                        <select
                          value={condCompareType}
                          onChange={(e) => updateExitConditionField(condIdx, 'compareType', e.target.value as any)}
                          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 h-7 cursor-pointer"
                        >
                          <option value="indicator">{locale === 'zh-TW' ? '指標' : 'Indicator'}</option>
                          <option value="value">{locale === 'zh-TW' ? '數值' : 'Value'}</option>
                        </select>

                        {/* 指標 2 或 固定數值 */}
                        {condCompareType === 'indicator' ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={condCompareIndicatorType}
                              onChange={(e) => updateExitConditionField(condIdx, 'compareIndicatorType', e.target.value as any)}
                              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-medium h-7 cursor-pointer"
                            >
                              <option value="EMA">EMA</option>
                              <option value="SMA">SMA</option>
                              <option value="PRICE">{locale === 'zh-TW' ? '現價 (Price)' : 'Price'}</option>
                              <option value="RSI">RSI</option>
                              <option value="MACD">MACD</option>
                            </select>
                            {condCompareIndicatorType !== 'PRICE' && (
                              <Input
                                type="number"
                                value={condComparePeriod}
                                min={1}
                                max={500}
                                placeholder="週期"
                                onChange={(e) => updateExitConditionField(condIdx, 'comparePeriod', Number(e.target.value))}
                                className="w-16 h-7 text-center bg-zinc-900 border-zinc-700 text-xs"
                              />
                            )}
                          </div>
                        ) : (
                          <Input
                            type="number"
                            value={condCompareValue}
                            placeholder="數值"
                            onChange={(e) => updateExitConditionField(condIdx, 'compareValue', Number(e.target.value))}
                            className="w-20 h-7 text-center bg-zinc-900 border-zinc-700 text-xs"
                          />
                        )}

                        {exitConditions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeExitCondition(condIdx)}
                            className="text-zinc-500 hover:text-red-400 p-1 ml-auto cursor-pointer"
                            title="刪除條件"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode 3: NONE */}
            {exitConditionMode === 'NONE' && (
              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-zinc-400 leading-relaxed">
                {locale === 'zh-TW'
                  ? '已啟用上方固定停利（未選取指標平倉）。若需依指標訊號平倉，請點擊上方「反向平倉」或「自訂平倉條件」。'
                  : 'Fixed Take Profit enabled. Click "Reverse Exit" or "Custom Exit" above to switch to indicator signal exit.'}
              </div>
            )}
          </div>
        </div>

        {/* 4. 帳戶資金與倉位管理 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3.5 bg-indigo-500 rounded-full" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              {locale === 'zh-TW' ? '資金與倉位管理' : 'Capital & Position Sizing'}
            </h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80">
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">
                {locale === 'zh-TW' ? '初始資金 (USDT)' : 'Initial Balance'}
              </label>
              <Input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(Number(e.target.value))}
                className="h-8 bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-indigo-300 font-semibold">
                {locale === 'zh-TW' ? '單筆風險佔比 (%)' : 'Risk Per Trade (%)'}
              </label>
              <Input
                type="number"
                value={riskPercentPerTrade}
                onChange={(e) => setRiskPercentPerTrade(Number(e.target.value))}
                step={0.5}
                min={0.1}
                max={20}
                className="h-8 bg-zinc-900 border-indigo-500/50 text-indigo-200 font-bold text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">
                {locale === 'zh-TW' ? '槓桿倍數 (Leverage)' : 'Leverage'}
              </label>
              <Input
                type="number"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                min={1}
                max={50}
                className="h-8 bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">
                {locale === 'zh-TW' ? '最大持倉數' : 'Max Positions'}
              </label>
              <Input
                type="number"
                value={maxPositions}
                onChange={(e) => setMaxPositions(Number(e.target.value))}
                min={1}
                max={10}
                className="h-8 bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
