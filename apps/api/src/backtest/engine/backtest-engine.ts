import { OHLCVKline } from '../../market/types';
import { BacktestConfig, BacktestState, Position } from './types';
import { PositionSizer } from './position-sizer';
import { PerformanceCalculator } from './performance';
import { alignMultiTimeframe } from '../../market/helpers/multi-timeframe-aligner';
import { getIntervalMs } from '../../market/historical-kline.service';
import { ExitEvaluator } from './exit-evaluator';
import { EntryEvaluator } from '../../market/helpers/entry-evaluator';
import { extractClosePricesFloat64 } from '../../market/helpers/indicator-evaluator';
import { alignMultiTimeframeMask, isRustCoreActive } from '../../market/rust-core';

export interface EngineInput {
  config: BacktestConfig;
  symbolKlines: Record<string, OHLCVKline[]>;
  higherKlines?: Record<string, Record<string, OHLCVKline[]>>;
}

function extractCloseTimesFloat64(klines: OHLCVKline[]): Float64Array {
  const out = new Float64Array(klines.length);
  for (let i = 0; i < klines.length; i++) {
    out[i] = klines[i].closeTime;
  }
  return out;
}

export class BacktestEngine {
  /**
   * 運行回測模擬 (Rust WASM 向量化指標計算 + 雙指針零配置時間軸游標)
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

    const symbols = config.symbols;
    const symbolCount = symbols.length;
    const symbolIndexMap = new Map<string, number>();
    for (let sIdx = 0; sIdx < symbolCount; sIdx++) {
      symbolIndexMap.set(symbols[sIdx], sIdx);
    }

    const mainBlock = config.timeframes.find((tf) => tf.interval === config.interval);
    const higherBlock = config.timeframes.find((tf) => tf.interval !== config.interval);
    const useRustAlign = isRustCoreActive();

    const klinesByIdx: OHLCVKline[][] = new Array(symbolCount);
    const entryMasks: Uint8Array[] = new Array(symbolCount);
    const reverseMasks: Uint8Array[] = new Array(symbolCount);
    const isSortedUnique: boolean[] = new Array(symbolCount).fill(true);

    // 僅當輸入資料含重複時間戳或未升冪排序時才退回 Map/Set 查找（兼容異常測試樣本）
    const fallbackKlineMaps: (Map<number, OHLCVKline> | null)[] = new Array(symbolCount).fill(null);
    const fallbackEntrySets: (Set<number> | null)[] = new Array(symbolCount).fill(null);
    const fallbackReverseSets: (Set<number> | null)[] = new Array(symbolCount).fill(null);

    // 2. 預先計算各幣種的策略進場與反向平倉信號遮罩 (透過 Rust WASM 向量化計算)
    for (let sIdx = 0; sIdx < symbolCount; sIdx++) {
      const symbol = symbols[sIdx];
      const mainKlines = symbolKlines[symbol] || [];
      klinesByIdx[sIdx] = mainKlines;

      if (mainKlines.length === 0) {
        entryMasks[sIdx] = new Uint8Array(0);
        reverseMasks[sIdx] = new Uint8Array(0);
        continue;
      }

      // 檢查時間序列是否嚴格升冪（100% 真實幣安資料皆為嚴格升冪，可用雙指針零配置游標）
      let sorted = true;
      for (let i = 1; i < mainKlines.length; i++) {
        if (mainKlines[i].openTime <= mainKlines[i - 1].openTime) {
          sorted = false;
          break;
        }
      }
      isSortedUnique[sIdx] = sorted;

      if (!mainBlock) {
        entryMasks[sIdx] = new Uint8Array(mainKlines.length);
        reverseMasks[sIdx] = new Uint8Array(mainKlines.length);
      } else {
        const mainCloses = extractClosePricesFloat64(mainKlines);
        const mainMask = EntryEvaluator.scanTimeframeBlockSignalsMask(
          mainKlines,
          mainBlock,
          mainCloses,
        );

        if (higherBlock && higherKlines?.[symbol]?.[higherBlock.interval]) {
          const hKlines = higherKlines[symbol][higherBlock.interval];
          const hMask = EntryEvaluator.scanTimeframeBlockSignalsMask(hKlines, higherBlock);

          if (useRustAlign) {
            const alignedMask = alignMultiTimeframeMask(
              extractCloseTimesFloat64(mainKlines),
              extractCloseTimesFloat64(hKlines),
              hMask,
            );
            for (let i = 0; i < mainMask.length; i++) {
              mainMask[i] = mainMask[i] === 1 && alignedMask[i] === 1 ? 1 : 0;
            }
          } else {
            const hSignals = Array.from(hMask, (v) => v === 1);
            const aligned = alignMultiTimeframe(mainKlines, hKlines, hSignals);
            for (let i = 0; i < mainMask.length; i++) {
              mainMask[i] = mainMask[i] === 1 && !!aligned[i] ? 1 : 0;
            }
          }
        }

        let reverseMask: Uint8Array;
        if (
          config.exitConditionMode === 'CUSTOM' &&
          config.exitConditions &&
          config.exitConditions.length > 0
        ) {
          reverseMask = EntryEvaluator.scanTimeframeBlockSignalsMask(
            mainKlines,
            { conditions: config.exitConditions },
            mainCloses,
          );
        } else if (config.exitConditionMode !== 'NONE' && config.useSignalExit !== false) {
          reverseMask = EntryEvaluator.scanReverseSignalsMask(mainKlines, mainBlock, mainCloses);
        } else {
          reverseMask = new Uint8Array(mainKlines.length);
        }

        entryMasks[sIdx] = mainMask;
        reverseMasks[sIdx] = reverseMask;
      }

      if (!sorted) {
        const kMap = new Map<number, OHLCVKline>();
        const eSet = new Set<number>();
        const rSet = new Set<number>();
        const eMask = entryMasks[sIdx];
        const rMask = reverseMasks[sIdx];
        for (let i = 0; i < mainKlines.length; i++) {
          const openTime = mainKlines[i].openTime;
          kMap.set(openTime, mainKlines[i]);
          if (eMask[i] === 1) eSet.add(openTime);
          if (rMask[i] === 1) rSet.add(openTime);
        }
        fallbackKlineMaps[sIdx] = kMap;
        fallbackEntrySets[sIdx] = eSet;
        fallbackReverseSets[sIdx] = rSet;
      }
    }

    // 3. 建立統一時間序列 (單幣種已排序時直接使用 Float64Array，省去 Set 與 Sort 配置)
    let timeline: Float64Array | number[];
    if (symbolCount === 1 && isSortedUnique[0]) {
      const klines = klinesByIdx[0];
      const arr = new Float64Array(klines.length);
      for (let i = 0; i < klines.length; i++) {
        arr[i] = klines[i].openTime;
      }
      timeline = arr;
    } else {
      const openTimesSet = new Set<number>();
      for (let sIdx = 0; sIdx < symbolCount; sIdx++) {
        const klines = klinesByIdx[sIdx];
        for (let i = 0; i < klines.length; i++) {
          openTimesSet.add(klines[i].openTime);
        }
      }
      timeline = Array.from(openTimesSet).sort((a, b) => a - b);
    }

    // 雙指針游標與當前時間點視窗緩衝 (徹底移除 klinesBySymbolTime 巢狀物件配置)
    const cursors = new Int32Array(symbolCount);
    const currentBarIndices = new Int32Array(symbolCount).fill(-1);
    const prevBarIndices = new Int32Array(symbolCount).fill(-1);
    const currentBarKlines: (OHLCVKline | undefined)[] = new Array(symbolCount);
    const lastKlineByIdx: (OHLCVKline | undefined)[] = new Array(symbolCount);
    const intervalMs = getIntervalMs(config.interval);

    // 4. 主時間軸狀態機循環
    for (let timelineIdx = 0; timelineIdx < timeline.length; timelineIdx++) {
      const openTime = timeline[timelineIdx];

      // a. 透過 O(1) 雙指針游標取得當前時間點的所有幣種 K 線 (含缺口 Forward Fill)
      for (let sIdx = 0; sIdx < symbolCount; sIdx++) {
        const symbol = symbols[sIdx];
        let originalKline: OHLCVKline | undefined;

        if (isSortedUnique[sIdx]) {
          const klines = klinesByIdx[sIdx];
          let cursor = cursors[sIdx];
          while (cursor < klines.length && klines[cursor].openTime < openTime) {
            cursor++;
          }
          cursors[sIdx] = cursor;

          if (cursor < klines.length && klines[cursor].openTime === openTime) {
            originalKline = klines[cursor];
            currentBarIndices[sIdx] = cursor;
          } else {
            currentBarIndices[sIdx] = -1;
          }
        } else {
          originalKline = fallbackKlineMaps[sIdx]?.get(openTime);
          currentBarIndices[sIdx] = -1;
        }

        if (originalKline) {
          currentBarKlines[sIdx] = originalKline;
          lastKlineByIdx[sIdx] = originalKline;
        } else {
          // 資料缺口處理：如果已持倉則 Forward Fill
          const isHolding = state.positions.some((p) => p.symbol === symbol);
          const prev = lastKlineByIdx[sIdx];
          if (isHolding && prev) {
            currentBarKlines[sIdx] = {
              openTime,
              open: prev.close,
              high: prev.close,
              low: prev.close,
              close: prev.close,
              volume: 0,
              closeTime: openTime + intervalMs - 1,
            };
          } else {
            currentBarKlines[sIdx] = undefined;
          }
        }
      }

      // b. 更新所有持倉的未實現損益 & 總權益
      let totalUnrealizedPnL = 0;
      for (const pos of state.positions) {
        const sIdx = symbolIndexMap.get(pos.symbol)!;
        const kline = currentBarKlines[sIdx];
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
          const sIdx = symbolIndexMap.get(pos.symbol)!;
          const kline = currentBarKlines[sIdx];
          const price = kline ? kline.close : pos.entryPrice;

          const fundingFee = pos.quantity * price * config.fundingRate * settlementsCount;
          state.currentBalance -= fundingFee;
          state.equity -= fundingFee;
        }
      }

      // d. 檢查平倉觸發器
      const positionsToKeep: Position[] = [];
      for (const pos of state.positions) {
        const sIdx = symbolIndexMap.get(pos.symbol)!;
        const kline = currentBarKlines[sIdx];
        if (!kline) {
          positionsToKeep.push(pos);
          continue;
        }

        const isReverseSignal = isSortedUnique[sIdx]
          ? currentBarIndices[sIdx] !== -1 && reverseMasks[sIdx][currentBarIndices[sIdx]] === 1
          : fallbackReverseSets[sIdx]?.has(openTime) || false;

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

        const enterCandidates: number[] = [];
        for (let sIdx = 0; sIdx < symbolCount; sIdx++) {
          const hasSignal = isSortedUnique[sIdx]
            ? prevBarIndices[sIdx] !== -1 && entryMasks[sIdx][prevBarIndices[sIdx]] === 1
            : fallbackEntrySets[sIdx]?.has(prevOpenTime) || false;

          if (!hasSignal || !currentBarKlines[sIdx]) {
            continue;
          }

          const symbol = symbols[sIdx];
          const isHolding = state.positions.some((p) => p.symbol === symbol);
          if (!isHolding) {
            enterCandidates.push(sIdx);
          }
        }

        // 依據成交金額（成交量高低）大者優先買入，相同則按字母排序
        if (enterCandidates.length > 1) {
          enterCandidates.sort((idxA, idxB) => {
            const klineA = currentBarKlines[idxA];
            const klineB = currentBarKlines[idxB];
            const volA = klineA ? klineA.volume * klineA.close : 0;
            const volB = klineB ? klineB.volume * klineB.close : 0;
            if (volB !== volA) {
              return volB - volA;
            }
            return symbols[idxA].localeCompare(symbols[idxB]);
          });
        }

        const maxPositions = config.maxPositions ?? 5;
        for (const sIdx of enterCandidates) {
          if (state.positions.length >= maxPositions) {
            break;
          }

          const symbol = symbols[sIdx];
          const kline = currentBarKlines[sIdx]!;
          const rawPrice = kline.open;
          const slippageFactor = config.slippage / 100;
          const actualEntryPrice = rawPrice * (1 + slippageFactor);

          // 1. 固定百分比停損 (Fixed Stop Loss)
          const slPercent = config.slPercent ?? 5.0;
          const slPrice = actualEntryPrice * (1 - slPercent / 100);

          // 2. 固定百分比停利 (Fixed Take Profit, 可選)
          const tpPercent = config.tpPercent;
          const tpPrice =
            tpPercent && tpPercent > 0 ? actualEntryPrice * (1 + tpPercent / 100) : 0;

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
            const isReverseImmediate = isSortedUnique[sIdx]
              ? currentBarIndices[sIdx] !== -1 && reverseMasks[sIdx][currentBarIndices[sIdx]] === 1
              : fallbackReverseSets[sIdx]?.has(openTime) || false;

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

      // 儲存當前 K 棒索引作為下一時間點的 prevBarIndices
      prevBarIndices.set(currentBarIndices);

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
        const sIdx = symbolIndexMap.get(pos.symbol)!;
        const lastKline = lastKlineByIdx[sIdx];
        const exitPrice = lastKline ? lastKline.close : pos.entryPrice;
        ExitEvaluator.executeClose(
          state,
          pos,
          exitPrice,
          lastTime,
          'TIMEOUT',
          config.takerFeeRate,
          0,
        );
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
          state.stats.monthlyDcaRoi = Number(
            (((finalDcaValue / totalInvested) - 1) * 100).toFixed(2),
          );
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
