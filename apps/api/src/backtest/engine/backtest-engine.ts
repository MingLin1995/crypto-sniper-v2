import { OHLCVKline } from '../../market/types';
import { BacktestConfig, BacktestState, Position } from './types';
import { PositionSizer } from './position-sizer';
import { PerformanceCalculator } from './performance';
import { alignMultiTimeframe } from '../../market/helpers/multi-timeframe-aligner';
import { getIntervalMs } from '../../market/historical-kline.service';
import { ExitEvaluator } from './exit-evaluator';
import { EntryEvaluator } from '../../market/helpers/entry-evaluator';

export interface EngineInput {
  config: BacktestConfig;
  symbolKlines: Record<string, OHLCVKline[]>;
  higherKlines?: Record<string, Record<string, OHLCVKline[]>>;
}

export class BacktestEngine {
  /**
   * 運行回測模擬 (極簡架構：純四指標 + 固定停損停利 + 訊號平倉)
   */
  static run(input: EngineInput): { state: BacktestState; warnings: string[] } {
    const { config, symbolKlines, higherKlines } = input;
    const warnings: string[] = [];

    // 1. 初始化回測狀態
    const state: BacktestState = {
      initialBalance: config.initialBalance,
      currentBalance: config.initialBalance,
      equity: config.initialBalance,
      positions: [],
      trades: [],
      equityCurve: [],
      stats: null as any,
    };

    // 2. 預先計算各幣種的策略進場與反向平倉信號時間點 (防止迴圈中重複計算，提升效能)
    const signalTimesBySymbol: Record<string, Set<number>> = {};
    const reverseSignalTimesBySymbol: Record<string, Set<number>> = {};

    for (const symbol of config.symbols) {
      signalTimesBySymbol[symbol] = new Set<number>();
      reverseSignalTimesBySymbol[symbol] = new Set<number>();
      const mainKlines = symbolKlines[symbol] || [];
      if (mainKlines.length === 0) continue;

      const mainBlock = config.timeframes.find((tf) => tf.interval === config.interval);
      const higherBlock = config.timeframes.find((tf) => tf.interval !== config.interval);

      if (!mainBlock) {
        continue;
      }

      const mainSignals = EntryEvaluator.scanTimeframeBlockSignals(mainKlines, mainBlock);
      let combinedSignals = mainSignals;

      if (higherBlock && higherKlines && higherKlines[symbol] && higherKlines[symbol][higherBlock.interval]) {
        const hKlines = higherKlines[symbol][higherBlock.interval];
        const hSignals = EntryEvaluator.scanTimeframeBlockSignals(hKlines, higherBlock);
        const aligned = alignMultiTimeframe(mainKlines, hKlines, hSignals);
        combinedSignals = mainSignals.map((sig, idx) => sig && !!aligned[idx]);
      }

      // 反向訊號 (快速自動反向如均線死叉，或自訂平倉指標條件)
      let reverseSignals: boolean[] = [];
      if (config.exitConditionMode === 'CUSTOM' && config.exitConditions && config.exitConditions.length > 0) {
        reverseSignals = EntryEvaluator.scanTimeframeBlockSignals(mainKlines, { conditions: config.exitConditions });
      } else if (config.exitConditionMode !== 'NONE' && config.useSignalExit !== false) {
        reverseSignals = EntryEvaluator.scanReverseSignals(mainKlines, mainBlock);
      } else {
        reverseSignals = new Array(mainKlines.length).fill(false);
      }

      for (let idx = 0; idx < mainKlines.length; idx++) {
        if (combinedSignals[idx]) {
          signalTimesBySymbol[symbol].add(mainKlines[idx].openTime);
        }
        if (reverseSignals[idx]) {
          reverseSignalTimesBySymbol[symbol].add(mainKlines[idx].openTime);
        }
      }
    }

    // 3. 建立統一時間序列 (所有幣種時間點的聯集)
    const openTimesSet = new Set<number>();
    for (const symbol of config.symbols) {
      const klines = symbolKlines[symbol] || [];
      for (const k of klines) {
        openTimesSet.add(k.openTime);
      }
    }
    const timeline = Array.from(openTimesSet).sort((a, b) => a - b);

    // 建立時間快取結構，加速尋找各幣種對應的 K 線
    const klinesBySymbolTime: Record<string, Record<number, OHLCVKline>> = {};
    for (const symbol of config.symbols) {
      klinesBySymbolTime[symbol] = {};
      const klines = symbolKlines[symbol] || [];
      for (const k of klines) {
        klinesBySymbolTime[symbol][k.openTime] = k;
      }
    }

    // 用於 forward fill 的最後已知 K 線
    const lastKlineBySymbol: Record<string, OHLCVKline> = {};
    const intervalMs = getIntervalMs(config.interval);

    // 4. 主時間軸狀態機循環
    for (let timelineIdx = 0; timelineIdx < timeline.length; timelineIdx++) {
      const openTime = timeline[timelineIdx];

      // a. 取得當前時間點的所有幣種 K 線 (含缺口 Forward Fill)
      const currentKlines: Record<string, OHLCVKline> = {};
      for (const symbol of config.symbols) {
        const originalKline = klinesBySymbolTime[symbol][openTime];
        if (originalKline) {
          currentKlines[symbol] = originalKline;
          lastKlineBySymbol[symbol] = originalKline;
        } else {
          // 資料缺口處理：如果已持倉則 Forward Fill
          const isHolding = state.positions.some((p) => p.symbol === symbol);
          if (isHolding && lastKlineBySymbol[symbol]) {
            const prev = lastKlineBySymbol[symbol];
            currentKlines[symbol] = {
              openTime,
              open: prev.close,
              high: prev.close,
              low: prev.close,
              close: prev.close,
              volume: 0,
              closeTime: openTime + intervalMs - 1,
            };
          }
        }
      }

      // b. 更新所有持倉的未實現損益 & 總權益
      let totalUnrealizedPnL = 0;
      for (const pos of state.positions) {
        const kline = currentKlines[pos.symbol];
        if (kline) {
          if (pos.side === 'LONG') {
            pos.unrealizedPnL = pos.quantity * (kline.close - pos.entryPrice);
          } else {
            pos.unrealizedPnL = pos.quantity * (pos.entryPrice - kline.close);
          }
          totalUnrealizedPnL += pos.unrealizedPnL;
        }
      }
      state.equity = state.currentBalance + totalUnrealizedPnL;

      // c. 處理資金費率結算
      const closeTime = openTime + intervalMs;
      const settlementsCount = this.countFundingSettlements(openTime, closeTime);
      if (settlementsCount > 0 && config.fundingRate !== 0) {
        for (const pos of state.positions) {
          const kline = currentKlines[pos.symbol];
          const price = kline ? kline.close : pos.entryPrice;
          
          const fundingFee = pos.quantity * price * config.fundingRate * settlementsCount;
          state.currentBalance -= fundingFee;
          state.equity -= fundingFee;
        }
      }

      // d. 檢查平倉觸發器
      const positionsToKeep: Position[] = [];
      for (const pos of state.positions) {
        const kline = currentKlines[pos.symbol];
        if (!kline) {
          positionsToKeep.push(pos);
          continue;
        }

        const isReverseSignal = reverseSignalTimesBySymbol[pos.symbol]?.has(openTime) || false;
        const closed = ExitEvaluator.evaluateAndClosePosition(
          state,
          pos,
          kline,
          config,
          isReverseSignal,
        );

        if (!closed) {
          positionsToKeep.push(pos);
        }
      }
      state.positions = positionsToKeep;

      // e. 評估訊號與開倉 (訊號成交延遲至第 i+1 根 K 棒的 Open 價)
      if (timelineIdx > 0) {
        const prevOpenTime = timeline[timelineIdx - 1];
        
        const symbolsToEnter: string[] = [];
        for (const symbol of config.symbols) {
          const hasSignal = signalTimesBySymbol[symbol]?.has(prevOpenTime);
          const isHolding = state.positions.some((p) => p.symbol === symbol);
          if (hasSignal && !isHolding && currentKlines[symbol]) {
            symbolsToEnter.push(symbol);
          }
        }

        // 依據成交金額（成交量高低）大者優先買入，相同則按字母排序
        symbolsToEnter.sort((a, b) => {
          const klineA = currentKlines[a];
          const klineB = currentKlines[b];
          const volA = klineA ? klineA.volume * klineA.close : 0;
          const volB = klineB ? klineB.volume * klineB.close : 0;
          if (volB !== volA) {
            return volB - volA;
          }
          return a.localeCompare(b);
        });

        const maxPositions = config.maxPositions ?? 5;
        for (const symbol of symbolsToEnter) {
          if (state.positions.length >= maxPositions) {
            break;
          }

          const kline = currentKlines[symbol];
          const rawPrice = kline.open;
          const slippageFactor = config.slippage / 100;
          const actualEntryPrice = rawPrice * (1 + slippageFactor);

          // 1. 固定百分比停損 (Fixed Stop Loss)
          const slPercent = config.slPercent ?? 5.0;
          const slPrice = actualEntryPrice * (1 - slPercent / 100);

          // 2. 固定百分比停利 (Fixed Take Profit, 可選)
          const tpPercent = config.tpPercent;
          const tpPrice = tpPercent && tpPercent > 0 ? actualEntryPrice * (1 + tpPercent / 100) : 0;

          const sizeInfo = PositionSizer.calculateSize(
            config,
            state.currentBalance,
            state.equity,
            actualEntryPrice,
            slPrice,
          );

          if (sizeInfo.warning && !warnings.includes(sizeInfo.warning)) {
            warnings.push(sizeInfo.warning);
          }

          if (sizeInfo.quantity > 0) {
            const entryFee = sizeInfo.quantity * actualEntryPrice * config.takerFeeRate;
            
            state.currentBalance -= sizeInfo.margin + entryFee;
            
            const newPos: Position = {
              symbol,
              side: 'LONG',
              entryPrice: actualEntryPrice,
              entryTime: openTime,
              margin: sizeInfo.margin,
              leverage: config.leverage,
              quantity: sizeInfo.quantity,
              slPrice,
              tpPrice,
              unrealizedPnL: 0,
              holdingCandles: 0,
            };

            // 入場當根 K 棒立即進行平倉檢查
            const isReverseImmediate = reverseSignalTimesBySymbol[symbol]?.has(openTime) || false;
            const closedImmediately = ExitEvaluator.evaluateAndClosePosition(
              state,
              newPos,
              kline,
              config,
              isReverseImmediate,
            );

            if (!closedImmediately) {
              state.positions.push(newPos);
            }
          }
        }
      }

      // f. 記錄權益曲線快照
      state.equityCurve.push({
        timestamp: openTime,
        equity: state.equity,
      });
    }

    // 5. 回測結束，平倉剩餘倉位 (TIMEOUT 平倉)
    if (state.positions.length > 0 && timeline.length > 0) {
      const lastTime = timeline[timeline.length - 1];
      for (const pos of state.positions) {
        const lastKline = lastKlineBySymbol[pos.symbol];
        const exitPrice = lastKline ? lastKline.close : pos.entryPrice;
        ExitEvaluator.executeClose(state, pos, exitPrice, lastTime, 'TIMEOUT', config.takerFeeRate, 0);
      }
      state.positions = [];
    }

    // 6. 計算最終績效指標
    state.stats = PerformanceCalculator.calculate(
      state.initialBalance,
      state.equity,
      state.equityCurve,
      state.trades,
      config.interval,
    );

    // 7. 計算基準對照指標 (單純買進與每月定期定額)
    const primarySymbol = config.symbols[0];
    const primaryKlines = symbolKlines[primarySymbol] || [];
    if (primaryKlines.length > 0) {
      const startPrice = primaryKlines[0].open;
      const endPrice = primaryKlines[primaryKlines.length - 1].close;
      if (startPrice > 0) {
        state.stats.buyHoldRoi = Number((((endPrice / startPrice) - 1) * 100).toFixed(2));

        const startTime = primaryKlines[0].openTime;
        const endTime = primaryKlines[primaryKlines.length - 1].openTime;
        const monthlyMs = 30 * 24 * 3600 * 1000;
        let totalInvested = 0;
        let totalCoins = 0;

        for (let t = startTime; t <= endTime; t += monthlyMs) {
          const candle = primaryKlines.find((k) => k.openTime >= t);
          if (candle && candle.open > 0) {
            const amount = 500;
            totalInvested += amount;
            totalCoins += amount / candle.open;
          }
        }

        if (totalInvested > 0) {
          const finalDcaValue = totalCoins * endPrice;
          state.stats.monthlyDcaRoi = Number((((finalDcaValue / totalInvested) - 1) * 100).toFixed(2));
        }
      }
    }

    return { state, warnings };
  }

  private static countFundingSettlements(openTime: number, closeTime: number): number {
    const period = 8 * 60 * 60 * 1000;
    const firstSettlement = Math.ceil(openTime / period) * period;
    if (firstSettlement >= closeTime) {
      return 0;
    }
    return Math.floor((closeTime - 1 - firstSettlement) / period) + 1;
  }
}
