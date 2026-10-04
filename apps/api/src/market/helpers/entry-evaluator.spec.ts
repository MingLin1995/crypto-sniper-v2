import { EntryEvaluator } from './entry-evaluator';
import { OHLCVKline } from '../types';

describe('EntryEvaluator (策略進場與反向信號掃描器)', () => {
  const createKlines = (prices: number[]): OHLCVKline[] => {
    return prices.map((p, idx) => ({
      openTime: 1000 + idx * 60000,
      open: p,
      high: p + 1,
      low: p - 1,
      close: p,
      volume: 100,
      closeTime: 1000 + (idx + 1) * 60000,
    }));
  };

  const uptrendPrices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const klines = createKlines(uptrendPrices);

  it('多個條件同時滿足時 (AND 邏輯) 應回傳 true', () => {
    const block = {
      conditions: [
        {
          type: 'PRICE',
          operator: 'gt',
          compareType: 'value',
          compareValue: 15,
        },
        {
          type: 'EMA',
          period: 3,
          operator: 'gt',
          compareType: 'value',
          compareValue: 10,
        },
      ],
    };

    const signals = EntryEvaluator.scanTimeframeBlockSignals(klines, block);
    expect(signals).toHaveLength(klines.length);

    // 前面價格 <= 15 的 K 棒應該為 false
    expect(signals[0]).toBe(false); // price = 10
    expect(signals[5]).toBe(false); // price = 15

    // 最後幾根 price > 15 且 EMA3 > 10 的 K 棒應該為 true
    expect(signals[klines.length - 1]).toBe(true);
  });

  it('scanReverseSignals 應正確將主條件運算子反轉 (gt -> lt)', () => {
    const block = {
      conditions: [
        {
          type: 'PRICE',
          operator: 'gt',
          compareType: 'value',
          compareValue: 15,
        },
      ],
    };

    const reverseSignals = EntryEvaluator.scanReverseSignals(klines, block);
    expect(reverseSignals).toHaveLength(klines.length);

    // 原條件 price > 15，反轉後為 price < 15
    // price = 10 應為 true
    expect(reverseSignals[0]).toBe(true);
    // price = 20 應為 false
    expect(reverseSignals[klines.length - 1]).toBe(false);
  });

  it('若條件為空陣列，scanReverseSignals 應全數回傳 false', () => {
    const block = { conditions: [] };
    const signals = EntryEvaluator.scanReverseSignals(klines, block);
    expect(signals.every((s) => s === false)).toBe(true);
  });
});
