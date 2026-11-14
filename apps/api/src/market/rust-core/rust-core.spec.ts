import {
  alignMultiTimeframeMask,
  calculateEquityCurveMetrics,
  isRustCoreActive,
  scanConditionMask,
} from './index';
import {
  calculateEMA,
  calculateEMAFallback,
  calculateMACD,
  calculateMACDFallback,
  calculateRSI,
  calculateRSIFallback,
  calculateSMA,
  calculateSMAFallback,
} from '../indicators';
import { alignMultiTimeframe } from '../helpers/multi-timeframe-aligner';
import { BacktestEngine } from '../../backtest/engine/backtest-engine';
import { BacktestConfig } from '../../backtest/engine/types';
import { OHLCVKline } from '../types';

function generateVolatileSeries(length: number, seed = 42): number[] {
  let state = seed >>> 0;
  const nextRand = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  const prices: number[] = [];
  let price = 45000;
  for (let i = 0; i < length; i++) {
    const pctChange = (nextRand() - 0.495) * 0.04;
    price = Math.max(1, price * (1 + pctChange));
    prices.push(Number(price.toFixed(4)));
  }
  return prices;
}

function generateMockKlines(
  count: number,
  startTime: number,
  intervalMs: number,
  seed: number,
  skipIndices: Set<number> = new Set(),
): OHLCVKline[] {
  const closes = generateVolatileSeries(count, seed);
  const klines: OHLCVKline[] = [];
  for (let i = 0; i < count; i++) {
    if (skipIndices.has(i)) continue;
    const close = closes[i];
    const open = i > 0 ? closes[i - 1] : close;
    const high = Math.max(open, close) * 1.005;
    const low = Math.min(open, close) * 0.995;
    const openTime = startTime + i * intervalMs;
    klines.push({
      openTime,
      open,
      high,
      low,
      close,
      volume: 1000 + (i % 50) * 25,
      closeTime: openTime + intervalMs - 1,
    });
  }
  return klines;
}

function expectSeriesMatch(actual: (number | null)[], expected: (number | null)[], eps = 1e-10) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    if (expected[i] === null) {
      expect(actual[i]).toBeNull();
    } else {
      expect(actual[i]).not.toBeNull();
      expect(Math.abs((actual[i] as number) - (expected[i] as number))).toBeLessThanOrEqual(eps);
    }
  }
}

describe('Rust WASM Quant Core (quant_core)', () => {
  it('應成功載入內嵌 Rust WebAssembly 核心模組', () => {
    expect(isRustCoreActive()).toBe(true);
  });

  describe('技術指標等價性驗證 (Rust WASM vs TypeScript Fallback)', () => {
    const testCases = [
      { name: '標準隨機波動序列 (500 根)', prices: generateVolatileSeries(500, 101) },
      { name: '極端零波動橫盤序列 (30 根)', prices: new Array(30).fill(100.5) },
      { name: '短於週期序列 (5 根)', prices: [10, 11, 12, 13, 14] },
      { name: '空陣列 (0 根)', prices: [] },
    ];

    for (const tc of testCases) {
      it(`SMA / EMA / RSI / MACD 數值應 100% 一致：${tc.name}`, () => {
        for (const period of [5, 14, 25, 60]) {
          expectSeriesMatch(calculateSMA(tc.prices, period), calculateSMAFallback(tc.prices, period));
          expectSeriesMatch(calculateEMA(tc.prices, period), calculateEMAFallback(tc.prices, period));
          expectSeriesMatch(calculateRSI(tc.prices, period), calculateRSIFallback(tc.prices, period));
        }

        const macdRust = calculateMACD(tc.prices, 12, 26, 9);
        const macdTs = calculateMACDFallback(tc.prices, 12, 26, 9);
        expectSeriesMatch(macdRust.macd, macdTs.macd);
        expectSeriesMatch(macdRust.signal, macdTs.signal);
        expectSeriesMatch(macdRust.histogram, macdTs.histogram);
      });
    }
  });

  describe('向量化訊號掃描與跨時框對齊驗證', () => {
    it('scanConditionMask 應正確處理指標對比、常數對比與 NaN 暖機區間', () => {
      const s1 = new Float64Array([Number.NaN, 10, 25, 15, 30]);
      const s2 = new Float64Array([5, 12, 20, Number.NaN, 25]);

      const indGt = scanConditionMask(s1, s2, 'indicator', 0, 'gt');
      expect(Array.from(indGt)).toEqual([0, 0, 1, 0, 1]);

      const valLt = scanConditionMask(s1, null, 'value', 20, 'lt');
      expect(Array.from(valLt)).toEqual([0, 1, 0, 1, 0]);
    });

    it('alignMultiTimeframeMask 應與 alignMultiTimeframe 行為完全一致且無未來函數', () => {
      const interval15m = 15 * 60 * 1000;
      const interval1h = 60 * 60 * 1000;
      const start = 1700000000000;

      const mainKlines = generateMockKlines(64, start, interval15m, 7);
      const higherKlines = generateMockKlines(16, start, interval1h, 19);
      const higherFlags = higherKlines.map((_, idx) => idx % 2 === 0);

      const expected = alignMultiTimeframe(mainKlines, higherKlines, higherFlags);
      const actualMask = alignMultiTimeframeMask(
        Float64Array.from(mainKlines.map((k) => k.closeTime)),
        Float64Array.from(higherKlines.map((k) => k.closeTime)),
        Uint8Array.from(higherFlags.map((v) => (v ? 1 : 0))),
      );

      expect(actualMask.length).toBe(expected.length);
      for (let i = 0; i < expected.length; i++) {
        if (expected[i] === null) {
          expect(actualMask[i]).toBe(255);
        } else {
          expect(actualMask[i]).toBe(expected[i] ? 1 : 0);
        }
      }
    });
  });

  describe('權益曲線指標與大規模多幣種回測壓力測試', () => {
    it('calculateEquityCurveMetrics 應準確算出 MDD、持續期間與 Sharpe Ratio', () => {
      const equities = new Float64Array([10000, 10500, 9500, 11000, 12000]);
      const metrics = calculateEquityCurveMetrics(equities, 10000, 365);

      expect(metrics.maxDrawdown).toBeCloseTo(1000 / 10500, 10);
      expect(metrics.maxDrawdownDuration).toBe(1);
      expect(metrics.sharpeRatio).toBeGreaterThan(0);
    });

    it('應能在多幣種 × 5000 根 K 線（含多時框對齊與資料缺口）快速完成回測且數值穩定', () => {
      const interval15m = 15 * 60 * 1000;
      const interval1h = 60 * 60 * 1000;
      const start = 1700000000000;
      const bars = 5000;

      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'];
      const symbolKlines: Record<string, OHLCVKline[]> = {};
      const higherKlines: Record<string, Record<string, OHLCVKline[]>> = {};

      symbols.forEach((sym, idx) => {
        const skips = idx === 1 ? new Set([50, 51, 200, 1200]) : new Set<number>();
        symbolKlines[sym] = generateMockKlines(bars, start, interval15m, 100 + idx * 17, skips);
        higherKlines[sym] = {
          '1h': generateMockKlines(Math.floor(bars / 4) + 50, start - 50 * interval1h, interval1h, 300 + idx),
        };
      });

      const config: BacktestConfig = {
        symbols,
        interval: '15m',
        startTime: start,
        endTime: start + bars * interval15m,
        leverage: 5,
        takerFeeRate: 0.0004,
        makerFeeRate: 0.0002,
        slippage: 0.05,
        slPercent: 3,
        tpPercent: 8,
        initialBalance: 10000,
        fundingRate: 0.0001,
        positionSizingMode: 'RISK_BASED',
        riskPercentPerTrade: 1,
        maxPositions: 3,
        exitConditionMode: 'AUTO_REVERSE',
        timeframes: [
          {
            interval: '15m',
            conditions: [
              {
                type: 'EMA',
                period: 12,
                operator: 'gt',
                compareType: 'indicator',
                compareIndicatorType: 'EMA',
                comparePeriod: 26,
              },
              {
                type: 'RSI',
                period: 14,
                operator: 'gt',
                compareType: 'value',
                compareValue: 45,
              },
            ],
          },
          {
            interval: '1h',
            conditions: [
              {
                type: 'MACD',
                macdFast: 12,
                macdSlow: 26,
                macdSignal: 9,
                macdProperty: 'hist',
                operator: 'gt',
                compareType: 'value',
                compareValue: 0,
              },
            ],
          },
        ],
      };

      const t0 = performance.now();
      const result1 = BacktestEngine.run({ config, symbolKlines, higherKlines });
      const elapsedMs = performance.now() - t0;
      const result2 = BacktestEngine.run({ config, symbolKlines, higherKlines });

      expect(result1.state.equityCurve.length).toBe(bars);
      expect(Number.isFinite(result1.state.equity)).toBe(true);
      expect(Number.isFinite(result1.state.stats.sharpeRatio)).toBe(true);
      expect(Number.isFinite(result1.state.stats.maxDrawdown)).toBe(true);
      expect(result1.state.trades).toEqual(result2.state.trades);
      expect(result1.state.stats).toEqual(result2.state.stats);
      expect(elapsedMs).toBeLessThan(2000);
    });
  });
});
