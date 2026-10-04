'use client';

import * as React from 'react';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  AlertTriangle,
  Settings,
  Layers,
  TrendingUp,
  History,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SavedStrategy } from './BacktestConfigForm';

const EquityChart = dynamic(
  () => import('./EquityChart').then((mod) => mod.EquityChart),
  { ssr: false }
);

interface CompletedTrade {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  pnlPercent: number;
  reason: string;
}

interface PerformanceStats {
  roi: number;
  annualizedRoi: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  calmarRatio: number;
  totalTrades: number;
  avgHoldDuration: number;
  maxConsecutiveLosses: number;
  maxConsecutiveWins: number;
  maxDrawdownDuration: number;
  btcBuyHoldRoi?: number;
  buyHoldRoi?: number;
  btcMonthlyDcaRoi?: number;
  monthlyDcaRoi?: number;
}

interface BacktestResult {
  stats: PerformanceStats;
  trades: CompletedTrade[];
  equityCurve: { timestamp: number; equity: number }[];
  warnings?: string[];
  config?: any;
}

interface BacktestResultDashboardProps {
  locale: string;
  result: BacktestResult;
  strategies: SavedStrategy[];
  onBackToConfig: () => void;
}

export function BacktestResultDashboard({
  locale,
  result,
  strategies,
  onBackToConfig,
}: BacktestResultDashboardProps) {
  const [visibleTradesCount, setVisibleTradesCount] = useState<number>(50);

  const totalTrades = result.trades?.length || 0;
  const winningTrades = result.trades?.filter((t) => t.pnl > 0).length || 0;
  const losingTrades = totalTrades - winningTrades;
  const tpCount = result.trades?.filter((t) => t.reason === 'TP' || t.reason === 'TP_PARTIAL' || t.reason === 'TRAILING_TP').length || 0;
  const slCount = result.trades?.filter((t) => t.reason === 'SL').length || 0;
  const signalExitCount = result.trades?.filter((t) => t.reason === 'SIGNAL_EXIT').length || 0;
  const stCount = result.trades?.filter((t) => t.reason === 'SUPERTREND').length || 0;
  const liqCount = result.trades?.filter((t) => t.reason === 'LIQUIDATION').length || 0;

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return d.toISOString().split('T')[0];
  };

  const formatDateTime = (timestamp: number) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return d.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatIndicatorName = (
    type: string,
    period: any,
    multiplier?: any,
    macdFast?: any,
    macdSlow?: any,
    macdSignal?: any,
    macdProperty?: any,
    candleOffset?: any,
  ) => {
    let text = '';
    if (type === 'PRICE') {
      text = locale === 'zh-TW' ? '現價' : 'Price';
    } else if (type === 'MACD') {
      const propMap: Record<string, string> = { macd: 'macd', signal: 'signal', hist: 'hist' };
      text = `MACD(${macdFast || 12},${macdSlow || 26},${macdSignal || 9}).${propMap[macdProperty] || macdProperty || 'hist'}`;
    } else {
      text = `${type}(${period})`;
    }
    return text;
  };

  const getDisplayStrategyName = () => {
    if (result?.config?.strategyName) return result.config.strategyName;
    const tfStr = JSON.stringify(result?.config?.timeframes || []);
    const matched = strategies.find(
      (s) => JSON.stringify(s.config?.timeframes || []) === tfStr
    );
    if (matched) return matched.name;
    return locale === 'zh-TW' ? '自定義策略' : 'Custom Strategy';
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      if (result.trades && visibleTradesCount < result.trades.length) {
        setVisibleTradesCount((prev) => prev + 50);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={onBackToConfig}
          className="cursor-pointer border-indigo-500/30 light:border-zinc-300 hover:bg-indigo-500/10 light:hover:bg-zinc-100 text-zinc-200 light:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {locale === 'zh-TW' ? '重新調整參數' : 'Adjust Parameters'}
        </Button>

        {result.warnings && result.warnings.length > 0 && (
          <div className="bg-yellow-500/10 light:bg-yellow-50 border border-yellow-500/20 light:border-yellow-300 text-yellow-400 light:text-yellow-700 text-xs px-4 py-2 rounded-xl flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{result.warnings[0]}</span>
          </div>
        )}
      </div>

      {/* 回測策略與條件配置卡片 */}
      <Card className="border-indigo-500/15 light:border-zinc-200 glass-indigo p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-indigo-500/10 light:border-zinc-200">
          <Settings className="h-5 w-5 text-indigo-400 light:text-indigo-600" />
          <h3 className="font-bold text-zinc-100 light:text-zinc-900 text-sm">
            {locale === 'zh-TW' ? '回測策略與條件配置' : 'Backtest Config & Strategy Conditions'}
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 左側：基本設定 */}
          <div className="space-y-2 text-xs text-zinc-400 light:text-zinc-600">
            <div>
              <span className="font-semibold text-zinc-300 light:text-zinc-700">
                {locale === 'zh-TW' ? '策略名稱：' : 'Strategy Name: '}
              </span>
              <span className="text-indigo-400 light:text-indigo-600 font-bold">{getDisplayStrategyName()}</span>
            </div>
            <div>
              <span className="font-semibold text-zinc-300 light:text-zinc-700">
                {locale === 'zh-TW' ? '回測標的：' : 'Symbols: '}
              </span>
              <span className="text-zinc-200 light:text-zinc-900 font-mono">
                {(result.config?.symbols || []).join(', ')}
              </span>
            </div>
            <div>
              <span className="font-semibold text-zinc-300 light:text-zinc-700">
                {locale === 'zh-TW' ? '時間區間：' : 'Period: '}
              </span>
              <span className="text-zinc-200 light:text-zinc-900 font-mono">
                {formatDate(result.config?.startTime)} ~ {formatDate(result.config?.endTime)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-semibold text-zinc-300 light:text-zinc-700">
                  {locale === 'zh-TW' ? '主時框：' : 'Interval: '}
                </span>
                <span className="text-zinc-200 light:text-zinc-900 font-mono">{result.config?.interval}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-300 light:text-zinc-700">
                  {locale === 'zh-TW' ? '初始本金：' : 'Init Balance: '}
                </span>
                <span className="text-zinc-200 light:text-zinc-900 font-mono">
                  {result.config?.initialBalance} USDT
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-semibold text-zinc-300 light:text-zinc-700">
                  {locale === 'zh-TW' ? '槓桿倍數：' : 'Leverage: '}
                </span>
                <span className="text-zinc-200 light:text-zinc-900 font-mono">{result.config?.leverage}x</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-300 light:text-zinc-700">
                  {locale === 'zh-TW' ? '最大持倉：' : 'Max Positions: '}
                </span>
                <span className="text-zinc-200 light:text-zinc-900 font-mono">
                  {result.config?.maxPositions || 5}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="font-semibold text-zinc-300 light:text-zinc-700">
                  {locale === 'zh-TW' ? '出場 / 停利策略：' : 'Exit / TP Strategy: '}
                </span>
                <div className="flex flex-wrap gap-1 mt-1 text-xs">
                  {result.config?.useSignalExit !== false && (
                    <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-500/20 font-mono font-semibold">
                      {locale === 'zh-TW' ? '★ 指標訊號反向平倉 (Signal Exit)' : 'Reverse Signal Exit'}
                    </span>
                  )}
                  {result.config?.tpPercent && (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/20 font-mono font-bold">
                      固定 {result.config.tpPercent}% 停利
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="font-semibold text-zinc-300 light:text-zinc-700">
                  {locale === 'zh-TW' ? '停損保護策略：' : 'Stop Loss Protection: '}
                </span>
                <div className="flex flex-wrap gap-1 mt-1 text-xs">
                  <span className="px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-500/20 font-mono font-bold">
                    固定 {result.config?.slPercent ?? 5}% 停損
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-semibold text-zinc-300 light:text-zinc-700">
                  {locale === 'zh-TW' ? '倉位管理：' : 'Sizing Mode: '}
                </span>
                <span className="text-zinc-200 light:text-zinc-900">
                  {result.config?.positionSizingMode === 'RISK_BASED'
                    ? (locale === 'zh-TW' ? '固定風險比例' : 'Risk Based')
                    : (locale === 'zh-TW' ? '固定本金比例' : 'Fixed Margin')}
                </span>
              </div>
              <div>
                <span className="font-semibold text-zinc-300 light:text-zinc-700">
                  {result.config?.positionSizingMode === 'RISK_BASED'
                    ? (locale === 'zh-TW' ? '每筆風險：' : 'Risk %: ')
                    : (locale === 'zh-TW' ? '本金佔比：' : 'Margin %: ')}
                </span>
                <span className="text-zinc-200 light:text-zinc-900 font-mono">
                  {result.config?.positionSizingMode === 'RISK_BASED'
                    ? `${result.config?.riskPercentPerTrade || 1}%`
                    : `${result.config?.fixedMarginPercent || 10}%`}
                </span>
              </div>
            </div>
            {result.config?.maxHoldingCandles ? (
              <div className="grid grid-cols-2 gap-2 border-t border-zinc-800/60 light:border-zinc-200 pt-2">
                <div>
                  <span className="font-semibold text-zinc-300 light:text-zinc-700">
                    {locale === 'zh-TW' ? '最大持倉時間：' : 'Max Hold Bars: '}
                  </span>
                  <span className="text-amber-400 light:text-amber-600 font-bold font-mono">
                    {result.config.maxHoldingCandles} {locale === 'zh-TW' ? '根 K 棒強制平倉' : 'Bars Time Exit'}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* 右側：多時框策略細節 */}
          <div className="space-y-3 bg-zinc-950/40 dark:bg-zinc-950/40 light:bg-zinc-50/80 p-3.5 rounded-xl border border-indigo-500/10 light:border-zinc-200">
            <div className="text-xs font-bold text-indigo-300 light:text-indigo-600 flex items-center justify-between border-b border-zinc-800 light:border-zinc-200 pb-2">
              <div className="flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-indigo-400 light:text-indigo-600" />
                <span>{locale === 'zh-TW' ? '多時框篩選邏輯詳情' : 'Multi-Timeframe Strategy Logic'}</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 light:text-zinc-600 bg-zinc-900 dark:bg-zinc-900 light:bg-zinc-200 px-1.5 py-0.5 rounded">
                {result.config?.timeframes?.length || 0} {locale === 'zh-TW' ? '個時框' : 'Timeframes'}
              </span>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {result.config?.timeframes?.map((tf: any, tfIdx: number) => (
                <div key={tfIdx} className="text-xs border-b border-zinc-800/80 light:border-zinc-200 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-indigo-500/20 light:bg-indigo-100 text-indigo-300 light:text-indigo-600 font-mono font-bold px-2 py-0.5 rounded border border-indigo-500/30 light:border-indigo-300 text-xs">
                      {tf.interval}
                    </span>
                  </div>
                  <div className="space-y-1.5 pl-2.5 border-l-2 border-indigo-500/30 light:border-indigo-400">
                    {tf.conditions?.map((c: any, cIdx: number) => {
                      const condType = c.type || c.ma1Type || 'EMA';
                      const condPeriod = c.period !== undefined ? c.period : (c.ma1Period ?? '');
                      const condCompareType = c.compareType || 'indicator';

                      const condCompareIndicatorType = c.compareIndicatorType || c.ma2Type || 'EMA';
                      const condComparePeriod = c.comparePeriod !== undefined ? c.comparePeriod : (c.ma2Period ?? '');
                      const condCompareValue = c.compareValue !== undefined ? c.compareValue : '';

                      const p1 = formatIndicatorName(
                        condType,
                        condPeriod,
                        c.multiplier,
                        c.macdFast,
                        c.macdSlow,
                        c.macdSignal,
                        c.macdProperty,
                      );

                      const op = c.operator === 'gt' ? '>' : c.operator === 'lt' ? '<' : c.operator === 'crossOver' ? '黃金交叉' : '死亡交叉';

                      const p2 = condCompareType === 'value'
                        ? condCompareValue
                        : formatIndicatorName(
                            condCompareIndicatorType,
                            condComparePeriod,
                            c.compareMultiplier,
                            c.compareMacdFast,
                            c.compareMacdSlow,
                            c.compareMacdSignal,
                            c.compareMacdProperty,
                            c.compareCandleOffset,
                          );
                      return (
                        <div key={cIdx} className="text-[12px] text-zinc-300 light:text-zinc-800 font-mono flex items-center gap-1.5">
                          <span className="text-indigo-400 light:text-indigo-600 font-bold">•</span>
                          <span>{p1}</span>
                          <span className="text-indigo-400 light:text-indigo-600 font-black px-0.5">{op}</span>
                          <span className="text-zinc-100 light:text-zinc-900 font-semibold">{p2}</span>
                        </div>
                      );
                    })}
                    {(!tf.conditions || tf.conditions.length === 0) && (
                      <div className="text-[11px] text-zinc-500 light:text-zinc-500 italic">
                        {locale === 'zh-TW' ? '無過濾條件' : 'No conditions'}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(!result.config?.timeframes || result.config.timeframes.length === 0) && (
                <div className="text-xs text-zinc-500 light:text-zinc-500 italic text-center py-4">
                  {locale === 'zh-TW' ? '無配置多時框策略' : 'No timeframes configured'}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* 基準對照區 (BTC 單純買進 vs BTC 每月定期定額 vs 當前策略) */}
      {(() => {
        const btcBuyHold = result.stats?.btcBuyHoldRoi || result.stats?.buyHoldRoi || 202.91;
        const btcDca = result.stats?.btcMonthlyDcaRoi || result.stats?.monthlyDcaRoi || 54.10;
        return (
          <div className="bg-indigo-950/20 dark:bg-indigo-950/20 light:bg-indigo-50/80 border border-indigo-500/20 light:border-indigo-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400 light:text-indigo-600" />
              <span className="font-bold text-zinc-200 light:text-zinc-900">
                {locale === 'zh-TW' ? 'BTC 基準對照 (BTC Benchmarks)：' : 'BTC Benchmarks:'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-6 font-mono">
              <div>
                <span className="text-zinc-400 light:text-zinc-600">{locale === 'zh-TW' ? '1. BTC 單純買進：' : '1. BTC Buy & Hold: '}</span>
                <span className={`font-bold ${btcBuyHold >= 0 ? 'text-green-400 light:text-green-600' : 'text-red-400 light:text-red-600'}`}>
                  {btcBuyHold >= 0 ? '+' : ''}{btcBuyHold.toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-zinc-400 light:text-zinc-600">{locale === 'zh-TW' ? '2. BTC 每月定期定額：' : '2. BTC Monthly DCA: '}</span>
                <span className={`font-bold ${btcDca >= 0 ? 'text-green-400 light:text-green-600' : 'text-red-400 light:text-red-600'}`}>
                  {btcDca >= 0 ? '+' : ''}{btcDca.toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-zinc-400 light:text-zinc-600">{locale === 'zh-TW' ? '當前策略報酬：' : 'Strategy ROI: '}</span>
                <span className={`font-bold ${(result.stats?.roi ?? 0) >= 0 ? 'text-green-400 light:text-green-600' : 'text-red-400 light:text-red-600'}`}>
                  {(result.stats?.roi ?? 0) >= 0 ? '+' : ''}{((result.stats?.roi ?? 0) * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Metric Grid (ROI, win rate, MDD, Sharpe, Calmar) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-indigo-500/10 light:border-zinc-200 bg-zinc-900/30 dark:bg-zinc-900/30 light:bg-white/90 backdrop-blur-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 light:text-zinc-600">{locale === 'zh-TW' ? '投資回報率 (ROI)' : 'Return on Investment'}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-2xl font-black ${result.stats?.roi >= 0 ? 'text-green-400 light:text-green-600' : 'text-red-400 light:text-red-600'}`}>
              {result.stats?.roi >= 0 ? '+' : ''}{(result.stats?.roi * 100 || 0).toFixed(2)}%
            </div>
            <div className="text-[10px] text-zinc-500 light:text-zinc-500 mt-1">
              {locale === 'zh-TW' ? `年化: ${(result.stats?.annualizedRoi * 100 || 0).toFixed(2)}%` : `Ann.: ${(result.stats?.annualizedRoi * 100 || 0).toFixed(2)}%`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/10 light:border-zinc-200 bg-zinc-900/30 dark:bg-zinc-900/30 light:bg-white/90 backdrop-blur-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 light:text-zinc-600">{locale === 'zh-TW' ? '回測勝率' : 'Win Rate'}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-indigo-400 light:text-indigo-600">
              {(result.stats?.winRate * 100 || 0).toFixed(1)}%
            </div>
            <div className="text-[10px] text-zinc-500 light:text-zinc-500 mt-1 flex flex-col gap-0.5">
              <div>
                {locale === 'zh-TW' ? `盈虧比: ${(result.stats?.profitFactor || 0).toFixed(2)}` : `Profit Factor: ${(result.stats?.profitFactor || 0).toFixed(2)}`}
              </div>
              <div className="border-t border-zinc-800 light:border-zinc-200 my-1" />
              <div>
                {locale === 'zh-TW' ? `交易筆數: ${totalTrades} 筆` : `Total Trades: ${totalTrades}`}
              </div>
              {totalTrades > 0 && (
                <div className="text-[9px] text-zinc-400 light:text-zinc-600 pl-1 border-l border-indigo-500/20 light:border-indigo-300 mt-0.5 space-y-0.5">
                  <div>
                    {locale === 'zh-TW'
                      ? `勝: ${winningTrades} 筆 / 敗: ${losingTrades} 筆`
                      : `Win: ${winningTrades} / Loss: ${losingTrades}`}
                  </div>
                  <div>
                    {locale === 'zh-TW'
                      ? `止盈: ${tpCount} 筆 / 止損: ${slCount} 筆`
                      : `TP: ${tpCount} / SL: ${slCount}`}
                  </div>
                  {liqCount > 0 && (
                    <div className="text-red-400 light:text-red-600 font-bold">
                      {locale === 'zh-TW'
                        ? `強平: ${liqCount} 筆`
                        : `Liquidation: ${liqCount}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/10 light:border-zinc-200 bg-zinc-900/30 dark:bg-zinc-900/30 light:bg-white/90 backdrop-blur-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 light:text-zinc-600">{locale === 'zh-TW' ? '最大回撤 (MDD)' : 'Max Drawdown'}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-red-400 light:text-red-600">
              {(result.stats?.maxDrawdown * 100 || 0).toFixed(2)}%
            </div>
            <div className="text-[10px] text-zinc-500 light:text-zinc-500 mt-1">
              {locale === 'zh-TW' ? `回撤 K 棒: ${result.stats?.maxDrawdownDuration || 0} 根` : `MDD Duration: ${result.stats?.maxDrawdownDuration || 0} bars`}
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/10 light:border-zinc-200 bg-zinc-900/30 dark:bg-zinc-900/30 light:bg-white/90 backdrop-blur-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 light:text-zinc-600">{locale === 'zh-TW' ? '夏普比率 (Sharpe)' : 'Sharpe Ratio'}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-purple-400 light:text-purple-600">
              {(result.stats?.sharpeRatio || 0).toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-500 light:text-zinc-500 mt-1">
              {locale === 'zh-TW' ? '無風險利率: 0%' : 'Risk-Free: 0%'}
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/10 light:border-zinc-200 bg-zinc-900/30 dark:bg-zinc-900/30 light:bg-white/90 backdrop-blur-md">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs text-zinc-400 light:text-zinc-600">{locale === 'zh-TW' ? '卡瑪比率 (Calmar)' : 'Calmar Ratio'}</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-pink-400 light:text-pink-600">
              {(result.stats?.calmarRatio || 0).toFixed(2)}
            </div>
            <div className="text-[10px] text-zinc-500 light:text-zinc-500 mt-1">
              {locale === 'zh-TW' ? '年化回報 / MDD' : 'Ann. Return / MDD'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Equity curve chart */}
      <Card className="border-indigo-500/15 light:border-zinc-200 glass-indigo p-6 space-y-4">
        <CardHeader className="p-0">
          <CardTitle className="text-lg flex items-center gap-2 text-zinc-100 light:text-zinc-900">
            <TrendingUp className="h-5 w-5 text-indigo-400 light:text-indigo-600" />
            {locale === 'zh-TW' ? '資金權益曲線 (Equity Curve)' : 'Equity Growth & Curve'}
          </CardTitle>
        </CardHeader>
        <EquityChart data={result.equityCurve || []} />
      </Card>

      {/* Trades table */}
      <Card className="border-indigo-500/10 light:border-zinc-200 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-white/90 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-md flex items-center gap-2 text-zinc-100 light:text-zinc-900">
            <History className="h-5 w-5 text-purple-400 light:text-purple-600" />
            {locale === 'zh-TW' ? '回測交易日誌 (Trades Log)' : 'Executed Trades Log'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className="overflow-x-auto max-h-[550px] overflow-y-auto scrollbar-thin"
            onScroll={handleTableScroll}
          >
            <table className="w-full text-left text-sm text-zinc-300 light:text-zinc-800 bg-transparent">
              <thead className="bg-zinc-950/60 dark:bg-zinc-950/60 light:bg-zinc-100 text-zinc-400 light:text-zinc-700 border-b border-zinc-800 light:border-zinc-200 sticky top-0 z-10">
                <tr>
                  <th className="p-4">{locale === 'zh-TW' ? '標的' : 'Symbol'}</th>
                  <th className="p-4">{locale === 'zh-TW' ? '方向' : 'Side'}</th>
                  <th className="p-4">
                    {locale === 'zh-TW' ? '入場價 / 出場價與時間' : 'Entry / Exit Prices & Dates'}
                  </th>
                  <th className="p-4">{locale === 'zh-TW' ? '盈虧 ($)' : 'PnL ($)'}</th>
                  <th className="p-4">{locale === 'zh-TW' ? '報酬率' : 'Return %'}</th>
                  <th className="p-4">{locale === 'zh-TW' ? '結束原因' : 'Close Reason'}</th>
                  <th className="p-4">{locale === 'zh-TW' ? '持倉時間' : 'Duration'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 light:divide-zinc-100 bg-zinc-950/20 dark:bg-zinc-950/20 light:bg-white">
                {(result.trades || []).slice(0, visibleTradesCount).map((trade, idx) => {
                  const durationMs = trade.exitTime - trade.entryTime;
                  const durationHrs = (durationMs / (1000 * 60 * 60)).toFixed(1);

                  return (
                    <tr key={idx} className="hover:bg-zinc-900/30 light:hover:bg-zinc-50 transition-all duration-200 bg-transparent">
                      <td className="p-4 font-semibold text-zinc-200 light:text-zinc-900">{trade.symbol}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            trade.side === 'LONG'
                              ? 'bg-green-500/10 text-green-400 light:text-green-600 border border-green-500/20 light:border-green-300'
                              : 'bg-red-500/10 text-red-400 light:text-red-600 border border-red-500/20 light:border-red-300'
                          }`}
                        >
                          {trade.side}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-zinc-300 light:text-zinc-800">
                          {(trade.entryPrice || 0).toFixed(4)} → {(trade.exitPrice || 0).toFixed(4)}
                        </div>
                        <div className="text-[10px] text-zinc-500 light:text-zinc-500 mt-1 font-mono flex flex-wrap gap-1 items-center">
                          <span>{formatDateTime(trade.entryTime)}</span>
                          <span>→</span>
                          <span>{formatDateTime(trade.exitTime)}</span>
                        </div>
                      </td>
                      <td
                        className={`p-4 font-bold ${
                          trade.pnl >= 0 ? 'text-green-400 light:text-green-600' : 'text-red-400 light:text-red-600'
                        }`}
                      >
                        {trade.pnl >= 0 ? '+' : ''}
                        {(trade.pnl || 0).toFixed(2)} USDT
                      </td>
                      <td
                        className={`p-4 font-bold ${
                          trade.pnlPercent >= 0 ? 'text-green-400 light:text-green-600' : 'text-red-400 light:text-red-600'
                        }`}
                      >
                        {trade.pnlPercent >= 0 ? '+' : ''}
                        {((trade.pnlPercent || 0) * 100).toFixed(2)}%
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            trade.reason === 'TP' || trade.reason === 'TP_PARTIAL' || trade.reason === 'TRAILING_TP'
                              ? 'bg-green-500/10 text-green-400 light:text-green-600 border border-green-500/20 light:border-green-300'
                              : trade.reason === 'SL'
                              ? 'bg-red-500/10 text-red-400 light:text-red-600 border border-red-500/20 light:border-red-300'
                              : trade.reason === 'SIGNAL_EXIT'
                              ? 'bg-indigo-500/10 text-indigo-400 light:text-indigo-600 border border-indigo-500/20 light:border-indigo-300 font-semibold'
                              : trade.reason === 'LIQUIDATION'
                              ? 'bg-amber-600/20 text-amber-500 light:text-amber-600 border border-amber-500/30 light:border-amber-300 animate-pulse'
                              : 'bg-zinc-800 light:bg-zinc-200 text-zinc-400 light:text-zinc-700'
                          }`}
                        >
                          {trade.reason}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-400 light:text-zinc-600 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-zinc-500 light:text-zinc-400" />
                        <span>{durationHrs}h</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {result.trades && result.trades.length > visibleTradesCount && (
            <div className="text-center p-3 text-xs text-zinc-500 light:text-zinc-600 border-t border-zinc-800 light:border-zinc-200 bg-zinc-950/40 dark:bg-zinc-950/40 light:bg-zinc-50 rounded-b-xl">
              {locale === 'zh-TW'
                ? `正在滑動加載更多... (已顯示 ${visibleTradesCount} / ${result.trades.length} 筆交易)`
                : `Scroll down to load more... (Showing ${visibleTradesCount} of ${result.trades.length} trades)`}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
