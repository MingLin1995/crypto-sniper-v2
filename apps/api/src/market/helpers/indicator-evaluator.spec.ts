import { normalizeCondition, evaluateCondition, scanSignals } from './indicator-evaluator';
import { MAConditionDto } from '../dto/screener.dto';

describe('indicator-evaluator (指標評估與掃描)', () => {
  describe('normalizeCondition', () => {
    it('應能將 ma1/ma2 舊版欄位正確對齊到新欄位', () => {
      const cond: MAConditionDto = {
        ma1Type: 'EMA',
        ma1Period: 5,
        operator: 'gt',
        ma2Type: 'SMA',
        ma2Period: 10,
      };
      const norm = normalizeCondition(cond);
      expect(norm.type).toBe('EMA');
      expect(norm.period).toBe(5);
      expect(norm.compareIndicatorType).toBe('SMA');
      expect(norm.comparePeriod).toBe(10);
      expect(norm.compareType).toBe('indicator');
    });

    it('應能正常對齊新版 MACD 欄位', () => {
      const cond: MAConditionDto = {
        type: 'MACD',
        macdFast: 12,
        macdSlow: 26,
        macdSignal: 9,
        macdProperty: 'hist',
        operator: 'gt',
        compareType: 'value',
        compareValue: 0,
      };
      const norm = normalizeCondition(cond);
      expect(norm.type).toBe('MACD');
      expect(norm.macdProperty).toBe('hist');
      expect(norm.compareType).toBe('value');
      expect(norm.compareValue).toBe(0);
    });
  });

  describe('evaluateCondition & scanSignals', () => {
    const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]; // 穩定上升，EMA5 > EMA10

    it('evaluateCondition 應能正確評估最後一根 K 棒是否符合 EMA 條件', () => {
      const cond: MAConditionDto = {
        ma1Type: 'EMA',
        ma1Period: 5,
        operator: 'gt',
        ma2Type: 'EMA',
        ma2Period: 10,
      };
      expect(evaluateCondition(prices, cond)).toBe(true);
    });

    it('scanSignals 應能回傳符合條件的歷史所有 K 棒 index 陣列', () => {
      const cond = {
        type: 'EMA' as const,
        period: 5,
        operator: 'gt' as const,
        compareType: 'value' as const,
        compareValue: 15,
      };
      const indices = scanSignals(prices, cond);
      expect(indices.length).toBeGreaterThan(0);
      expect(indices[indices.length - 1]).toBe(prices.length - 1);
    });

    it('應能支援物件陣列作為 K 線輸入', () => {
      const klines = prices.map(p => ({ close: p }));
      const cond = {
        type: 'EMA' as const,
        period: 5,
        operator: 'gt' as const,
        compareType: 'value' as const,
        compareValue: 15,
      };
      const indices = scanSignals(klines, cond);
      expect(indices.length).toBeGreaterThan(0);
    });

    it('應能正確評估 PRICE 與 EMA 的比較 (現價 > EMA)', () => {
      const klines = [
        { close: 10, high: 10, low: 10, volume: 100 },
        { close: 12, high: 12, low: 12, volume: 100 },
        { close: 14, high: 14, low: 14, volume: 100 },
        { close: 16, high: 16, low: 16, volume: 100 },
        { close: 18, high: 18, low: 18, volume: 100 },
        { close: 20, high: 20, low: 20, volume: 100 },
      ];
      const cond = {
        type: 'PRICE' as const,
        operator: 'gt' as const,
        compareType: 'indicator' as const,
        compareIndicatorType: 'EMA' as const,
        comparePeriod: 3,
      };
      expect(evaluateCondition(klines, cond)).toBe(true);
    });

    it('應能正確評估 RSI 與數值的比較 (RSI > 50)', () => {
      const klines = [
        { close: 10, high: 10, low: 10, volume: 100 },
        { close: 12, high: 12, low: 12, volume: 100 },
        { close: 14, high: 14, low: 14, volume: 100 },
        { close: 16, high: 16, low: 16, volume: 100 },
        { close: 18, high: 18, low: 18, volume: 100 },
        { close: 20, high: 20, low: 20, volume: 100 },
      ];
      const cond = {
        type: 'RSI' as const,
        period: 5,
        operator: 'gt' as const,
        compareType: 'value' as const,
        compareValue: 50,
      };
      expect(evaluateCondition(klines, cond)).toBe(true);
    });
  });
});
