'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@/components/AppProviders';
import { ThemeLanguageSelector } from '@/components/ThemeLanguageSelector';
import { Sparkles, ArrowLeft, AlertTriangle } from 'lucide-react';

import { BacktestConfigForm, SavedStrategy } from './components/BacktestConfigForm';
import { RecentJobsList } from './components/RecentJobsList';
import { BacktestResultDashboard } from './components/BacktestResultDashboard';
import { MACondition } from 'shared';

interface WatchlistItem {
  symbol: string;
}

export default function BacktestPage() {
  const router = useRouter();
  const { locale } = useApp();

  // 頁面狀態：CONFIG (設定表單), RUNNING (排程中/進度), RESULT (回測結果)
  const [viewState, setViewState] = useState<'CONFIG' | 'RUNNING' | 'RESULT'>('CONFIG');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  // 表單設定狀態
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [symbolText, setSymbolText] = useState('');
  const [interval, setInterval] = useState('15m');
  const [leverage, setLeverage] = useState(5);
  // --- Simple Stop Loss (SL) & Exit States ---
  const [slPercent, setSlPercent] = useState(5.0);
  const [useTpFixed, setUseTpFixed] = useState(false);
  const [tpPercent, setTpPercent] = useState(15.0);
  const [exitConditionMode, setExitConditionMode] = useState<'AUTO_REVERSE' | 'CUSTOM' | 'NONE'>('AUTO_REVERSE');
  const [exitConditions, setExitConditions] = useState<MACondition[]>([
    {
      type: 'PRICE',
      operator: 'lt',
      compareType: 'indicator',
      compareIndicatorType: 'EMA',
      comparePeriod: 20,
    },
  ]);

  // --- Account & Risk Sizing ---
  const [initialBalance, setInitialBalance] = useState(10000);
  const [positionSizingMode, setPositionSizingMode] = useState<'FIXED_PERCENT' | 'RISK_BASED'>('RISK_BASED');
  const [fixedMarginPercent, setFixedMarginPercent] = useState(10);
  const [riskPercentPerTrade, setRiskPercentPerTrade] = useState(1);
  const [maxPositions, setMaxPositions] = useState(5);
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

  // 多時框篩選配置
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [strategies, setStrategies] = useState<SavedStrategy[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // 結果狀態
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobHistory, setJobHistory] = useState<any[]>([]);

  useEffect(() => {
    // 預設日期區間為最近 1 個月
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setStartDateStr(start.toISOString().split('T')[0]);
    setEndDateStr(end.toISOString().split('T')[0]);

    // 載入我的最愛 Watchlist 與 儲存的篩選策略
    fetchWatchlist();
    fetchStrategies();
    fetchHistory();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`/api/watchlist?t=${Date.now()}`, { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setWatchlist(list.map((w: WatchlistItem) => w.symbol));
      }
    } catch (err) {
      console.error('Failed to fetch watchlist', err);
    }
  };

  const fetchStrategies = async () => {
    try {
      const res = await fetch(`/api/strategies?t=${Date.now()}`, { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const json = await res.json();
        const list = json.data || [];
        setStrategies(list.filter((s: SavedStrategy) => s.name !== '__categories__'));
      }
    } catch (err) {
      console.error('Failed to fetch strategies', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/backtest/history?limit=5&t=${Date.now()}`, { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.ok) {
        const json = await res.json();
        const history = json.data?.items || [];
        setJobHistory(history);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  // 提交回測任務
  const handleStartBacktest = async () => {
    setError(null);

    // 取得選定策略的篩選條件
    const strategy = strategies.find(s => s.id === selectedStrategyId);
    if (!strategy) {
      setError(locale === 'zh-TW' ? '請選擇一個篩選策略' : 'Please select a strategy');
      return;
    }

    const startTs = new Date(startDateStr).getTime();
    const endTs = new Date(endDateStr).getTime();

    // 交易對檢查
    const symbols = selectedSymbols;

    if (symbols.length === 0) {
      setError(locale === 'zh-TW' ? '請選擇至少一個交易對' : 'Please select at least one symbol');
      return;
    }

    if (symbols.length > 10) {
      setError(locale === 'zh-TW' ? '交易對數量上限為 10 個' : 'Maximum 10 symbols allowed');
      return;
    }

    if (exitConditionMode === 'NONE' && !useTpFixed) {
      setError(locale === 'zh-TW' ? '請至少勾選「固定停利」或選取「指標出場（反向平倉 / 自訂條件）」以確保獲利平倉' : 'Please enable Fixed Take Profit or Signal Exit');
      return;
    }

    const bodyData = {
      strategyId: selectedStrategyId || undefined,
      strategyName: strategy.name || undefined,
      symbols,
      interval,
      startTime: startTs,
      endTime: endTs,
      leverage,
      slPercent,
      tpPercent: useTpFixed ? tpPercent : undefined,
      useSignalExit: exitConditionMode !== 'NONE',
      exitConditionMode,
      exitConditions: exitConditionMode === 'CUSTOM' ? exitConditions : undefined,
      initialBalance,
      positionSizingMode,
      fixedMarginPercent,
      riskPercentPerTrade,
      maxPositions,
      timeframes: strategy.config.timeframes,
    };

    try {
      setViewState('RUNNING');
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      const data = await res.json();

      if (res.status === 409) {
        // 重複發起衝突，載入現有任務
        const jobId = data.jobId || (data.message && typeof data.message === 'object' && !Array.isArray(data.message) ? (data.message as any).jobId : undefined);
        setCurrentJobId(jobId);
        startPolling(jobId);
        return;
      }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to start backtest');
      }

      setCurrentJobId(data.data.id);
      startPolling(data.data.id);
    } catch (err: any) {
      setError(err.message);
      setViewState('CONFIG');
    }
  };

  const handleDeleteJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    if (!confirm(locale === 'zh-TW' ? '確定要刪除此回測紀錄嗎？' : 'Are you sure you want to delete this backtest job?')) return;
    try {
      const res = await fetch(`/api/backtest/${jobId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchHistory();
        if (currentJobId === jobId) {
          setViewState('CONFIG');
          setResult(null);
        }
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete job');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 任務狀態輪詢
  const pollIntervalRef = useRef<any>(null);
  const startPolling = (jobId: string) => {
    console.log('[Backtest] startPolling called for jobId:', jobId);
    if (pollIntervalRef.current) {
      console.log('[Backtest] Clearing existing timer:', pollIntervalRef.current);
      clearTimeout(pollIntervalRef.current);
    }

    const poll = async () => {
      try {
        const timestamp = Date.now();
        console.log(`[Backtest] Polling job ${jobId} at timestamp ${timestamp}`);
        const res = await fetch(`/api/backtest/${jobId}?t=${timestamp}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`Failed to query job status: ${res.statusText}`);
        }
        const data = await res.json();
        console.log('[Backtest] Polling response received:', data);

        const jobData = data.data;

        if (jobData.queuePosition) {
          setQueuePosition(jobData.queuePosition);
        }

        if (jobData.status === 'COMPLETED') {
          console.log('[Backtest] Job COMPLETED!');
          const parsedResult = typeof jobData.result === 'string'
            ? JSON.parse(jobData.result)
            : jobData.result;
          setResult({
            ...parsedResult,
            config: jobData.config,
          });
          setViewState('RESULT');
          fetchHistory();
        } else if (jobData.status === 'FAILED') {
          console.log('[Backtest] Job FAILED!');
          setError(jobData.error || 'Backtest simulation failed.');
          setViewState('CONFIG');
          fetchHistory();
        } else {
          console.log('[Backtest] Job status is:', jobData.status, '- Scheduling next poll in 2s');
          pollIntervalRef.current = setTimeout(poll, 2000);
        }
      } catch (err: any) {
        console.error('[Backtest] Polling error:', err);
        setError(err.message);
        setViewState('CONFIG');
      }
    };

    pollIntervalRef.current = setTimeout(poll, 2000);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearTimeout(pollIntervalRef.current);
    };
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-7xl space-y-6">
      {/* 標題與 ThemeLanguageSelector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-indigo-500/10 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-indigo-400 animate-pulse" />
            {locale === 'zh-TW' ? '策略回測系統' : 'Strategy Backtester'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {locale === 'zh-TW'
              ? '驗證多時框指標篩選策略，支援動態多條件止盈止損與歷史 K 線數據回放。'
              : 'Test multi-timeframe strategies with historical data & modular risk settings.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/screener')}
            className="cursor-pointer border-indigo-500/30 hover:bg-indigo-500/10 text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {locale === 'zh-TW' ? '返回篩選器' : 'Back to Screener'}
          </Button>
          <ThemeLanguageSelector />
        </div>
      </div>

      {/* 錯誤通知 */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 dark:bg-red-950/40 light:bg-red-50 border border-red-500/30 text-red-300 dark:text-red-300 light:text-red-700 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* View 1: CONFIG Form & History Sidebar */}
      {viewState === 'CONFIG' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <BacktestConfigForm
              locale={locale}
              watchlist={watchlist}
              strategies={strategies}
              selectedStrategyId={selectedStrategyId}
              setSelectedStrategyId={setSelectedStrategyId}
              selectedSymbols={selectedSymbols}
              setSelectedSymbols={setSelectedSymbols}
              symbolText={symbolText}
              setSymbolText={setSymbolText}
              interval={interval}
              setInterval={setInterval}
              leverage={leverage}
              setLeverage={setLeverage}

              slPercent={slPercent}
              setSlPercent={setSlPercent}
              useTpFixed={useTpFixed}
              setUseTpFixed={setUseTpFixed}
              tpPercent={tpPercent}
              setTpPercent={setTpPercent}
              exitConditionMode={exitConditionMode}
              setExitConditionMode={setExitConditionMode}
              exitConditions={exitConditions}
              setExitConditions={setExitConditions}

              initialBalance={initialBalance}
              setInitialBalance={setInitialBalance}
              positionSizingMode={positionSizingMode}
              setPositionSizingMode={setPositionSizingMode}
              fixedMarginPercent={fixedMarginPercent}
              setFixedMarginPercent={setFixedMarginPercent}
              riskPercentPerTrade={riskPercentPerTrade}
              setRiskPercentPerTrade={setRiskPercentPerTrade}
              maxPositions={maxPositions}
              setMaxPositions={setMaxPositions}
              startDateStr={startDateStr}
              setStartDateStr={setStartDateStr}
              endDateStr={endDateStr}
              setEndDateStr={setEndDateStr}
              onStartBacktest={handleStartBacktest}
            />
          </div>
          <div className="lg:col-span-4">
            <RecentJobsList
              locale={locale}
              jobHistory={jobHistory}
              onSelectJob={(jobId) => {
                startPolling(jobId);
                setViewState('RUNNING');
              }}
              onDeleteJob={handleDeleteJob}
            />
          </div>
        </div>
      )}

      {/* View 2: RUNNING State */}
      {viewState === 'RUNNING' && (
        <Card className="border-indigo-500/15 glass-indigo text-center py-16">
          <CardContent className="space-y-6">
            <div className="relative w-20 h-20 mx-auto bg-transparent">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-zinc-100">
                {locale === 'zh-TW' ? '回測引擎計算中...' : 'Backtest Engine Running...'}
              </h3>
              <p className="text-sm text-zinc-400">
                {locale === 'zh-TW' ? '正在下載歷史行情、對齊多時框時間軸並模擬撮合交易。' : 'Syncing historical OHLCV data and checking entry criteria...'}
              </p>
            </div>
            {queuePosition && (
              <div className="inline-block px-4 py-1.5 bg-indigo-500/10 text-indigo-400 text-xs rounded-full border border-indigo-500/20 font-semibold">
                {locale === 'zh-TW' ? `目前佇列排隊位置: ${queuePosition}` : `Queue Position: ${queuePosition}`}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* View 3: RESULT Dashboard */}
      {viewState === 'RESULT' && result && (
        <BacktestResultDashboard
          locale={locale}
          result={result}
          strategies={strategies}
          onBackToConfig={() => setViewState('CONFIG')}
        />
      )}
    </div>
  );
}
