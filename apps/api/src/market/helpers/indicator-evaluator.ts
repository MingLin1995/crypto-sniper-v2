import { MAConditionDto } from '../dto/screener.dto';
import {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
} from '../indicators';

export interface NormalizedCondition {
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'PRICE';
  period?: number;
  macdFast?: number;
  macdSlow?: number;
  macdSignal?: number;
  macdProperty?: 'macd' | 'signal' | 'hist';
  operator: 'gt' | 'lt';
  compareType: 'indicator' | 'value';
  compareIndicatorType?: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'PRICE';
  comparePeriod?: number;
  compareMacdFast?: number;
  compareMacdSlow?: number;
  compareMacdSignal?: number;
  compareMacdProperty?: 'macd' | 'signal' | 'hist';
  compareValue?: number;
}

export type KlineInput = number[] | { close: number; high?: number; low?: number; volume?: number; open?: number }[];

export function normalizeCondition(cond: MAConditionDto): NormalizedCondition {
  if (cond.ma1Type && cond.ma1Period !== undefined && cond.ma2Type && cond.ma2Period !== undefined) {
    return {
      type: cond.ma1Type as any,
      period: cond.ma1Period,
      operator: cond.operator,
      compareType: 'indicator',
      compareIndicatorType: cond.ma2Type as any,
      comparePeriod: cond.ma2Period,
    };
  }
  return {
    type: (cond.type || 'EMA') as any,
    period: cond.period,
    macdFast: cond.macdFast,
    macdSlow: cond.macdSlow,
    macdSignal: cond.macdSignal,
    macdProperty: cond.macdProperty,
    operator: cond.operator,
    compareType: cond.compareType || 'indicator',
    compareIndicatorType: cond.compareIndicatorType as any,
    comparePeriod: cond.comparePeriod,
    compareMacdFast: cond.compareMacdFast,
    compareMacdSlow: cond.compareMacdSlow,
    compareMacdSignal: cond.compareMacdSignal,
    compareMacdProperty: cond.compareMacdProperty,
    compareValue: cond.compareValue,
  };
}

export function getIndicatorSeries(
  input: KlineInput,
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'PRICE',
  params: {
    period?: number;
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
    macdProperty?: 'macd' | 'signal' | 'hist';
  },
): (number | null)[] {
  // If inputs are number[], map them to dummy KLines to avoid crash and retain compatibility
  const klines = Array.isArray(input) && typeof input[0] === 'number'
    ? (input as number[]).map(c => ({ open: c, high: c, low: c, close: c, volume: 0, openTime: 0, closeTime: 0 }))
    : (input as any[]);

  const prices = klines.map(k => k.close);

  switch (type) {
    case 'SMA':
      return calculateSMA(prices, params.period || 14);
    case 'EMA':
      return calculateEMA(prices, params.period || 14);
    case 'RSI':
      return calculateRSI(prices, params.period || 14);
    case 'MACD': {
      const fast = params.macdFast || 12;
      const slow = params.macdSlow || 26;
      const sig = params.macdSignal || 9;
      const macdRes = calculateMACD(prices, fast, slow, sig);
      if (params.macdProperty === 'signal') return macdRes.signal;
      if (params.macdProperty === 'hist') return macdRes.histogram;
      return macdRes.macd;
    }
    case 'PRICE':
      return prices;
    default:
      return Array(prices.length).fill(null);
  }
}

export function isNormalizedCondition(cond: any): cond is NormalizedCondition {
  return (
    cond &&
    typeof cond === 'object' &&
    'type' in cond &&
    cond.type !== undefined &&
    'compareType' in cond &&
    cond.compareType !== undefined &&
    !('ma1Type' in cond)
  );
}

export function evaluateCondition(prices: KlineInput, cond: MAConditionDto | NormalizedCondition): boolean {
  const norm = isNormalizedCondition(cond) ? cond : normalizeCondition(cond);

  const series1 = getIndicatorSeries(prices, norm.type, {
    period: norm.period,
    macdFast: norm.macdFast,
    macdSlow: norm.macdSlow,
    macdSignal: norm.macdSignal,
    macdProperty: norm.macdProperty,
  });

  const idx1 = series1.length - 1;
  if (idx1 < 0) return false;

  const val1 = series1[idx1];

  if (val1 === null || val1 === undefined || isNaN(val1)) {
    return false;
  }

  let val2: number | null = null;
  if (norm.compareType === 'value') {
    val2 = norm.compareValue !== undefined ? norm.compareValue : null;
  } else {
    const compType = norm.compareIndicatorType || norm.type;
    const compPeriod = norm.comparePeriod !== undefined ? norm.comparePeriod : norm.period;
    const series2 = getIndicatorSeries(prices, compType, {
      period: compPeriod,
      macdFast: norm.compareMacdFast !== undefined ? norm.compareMacdFast : norm.macdFast,
      macdSlow: norm.compareMacdSlow !== undefined ? norm.compareMacdSlow : norm.macdSlow,
      macdSignal: norm.compareMacdSignal !== undefined ? norm.compareMacdSignal : norm.macdSignal,
      macdProperty: norm.compareMacdProperty || norm.macdProperty,
    });
    const idx2 = series2.length - 1;
    if (idx2 < 0) return false;
    val2 = series2[idx2];
  }

  if (val2 === null || val2 === undefined || isNaN(val2)) {
    return false;
  }

  if (norm.operator === 'gt') {
    return val1 > val2;
  } else if (norm.operator === 'lt') {
    return val1 < val2;
  }

  return false;
}

export function scanSignals(prices: KlineInput, cond: NormalizedCondition): number[] {
  const series1 = getIndicatorSeries(prices, cond.type, {
    period: cond.period,
    macdFast: cond.macdFast,
    macdSlow: cond.macdSlow,
    macdSignal: cond.macdSignal,
    macdProperty: cond.macdProperty,
  });

  const len = series1.length;
  const signalIndices: number[] = [];

  let series2: (number | null)[] | null = null;
  if (cond.compareType !== 'value') {
    const compType = cond.compareIndicatorType || cond.type;
    const compPeriod = cond.comparePeriod !== undefined ? cond.comparePeriod : cond.period;
    series2 = getIndicatorSeries(prices, compType, {
      period: compPeriod,
      macdFast: cond.compareMacdFast !== undefined ? cond.compareMacdFast : cond.macdFast,
      macdSlow: cond.compareMacdSlow !== undefined ? cond.compareMacdSlow : cond.macdSlow,
      macdSignal: cond.compareMacdSignal !== undefined ? cond.compareMacdSignal : cond.macdSignal,
      macdProperty: cond.compareMacdProperty || cond.macdProperty,
    });
  }

  for (let idx = 0; idx < len; idx++) {
    const val1 = series1[idx];
    if (val1 === null || val1 === undefined || isNaN(val1)) {
      continue;
    }

    let val2: number | null = null;
    if (cond.compareType === 'value') {
      val2 = cond.compareValue !== undefined ? cond.compareValue : null;
    } else if (series2) {
      val2 = series2[idx];
    }

    if (val2 === null || val2 === undefined || isNaN(val2)) {
      continue;
    }

    if (cond.operator === 'gt') {
      if (val1 > val2) {
        signalIndices.push(idx);
      }
    } else if (cond.operator === 'lt') {
      if (val1 < val2) {
        signalIndices.push(idx);
      }
    }
  }

  return signalIndices;
}
