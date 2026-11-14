import { MAConditionDto } from '../dto/screener.dto';
import {
  calculateSMAFloat64Series,
  calculateEMAFloat64Series,
  calculateRSIFloat64Series,
  calculateMACDFloat64Series,
} from '../indicators';
import {
  float64ToNullableArray,
  isRustCoreActive,
  scanConditionMask,
} from '../rust-core';

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

export type KlineInput =
  | number[]
  | { close: number; high?: number; low?: number; volume?: number; open?: number }[];

export function normalizeCondition(cond: MAConditionDto): NormalizedCondition {
  if (
    cond.ma1Type &&
    cond.ma1Period !== undefined &&
    cond.ma2Type &&
    cond.ma2Period !== undefined
  ) {
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

/**
 * Extract close prices from KlineInput into a contiguous Float64Array without allocating dummy kline objects.
 */
export function extractClosePricesFloat64(input: KlineInput | Float64Array): Float64Array {
  if (input instanceof Float64Array) {
    return input;
  }
  const len = input.length;
  if (len === 0) {
    return new Float64Array(0);
  }
  if (typeof input[0] === 'number') {
    return Float64Array.from(input as number[]);
  }
  const out = new Float64Array(len);
  const klines = input as { close: number }[];
  for (let i = 0; i < len; i++) {
    out[i] = klines[i].close;
  }
  return out;
}

export function getIndicatorSeriesFloat64(
  input: KlineInput | Float64Array,
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'PRICE',
  params: {
    period?: number;
    macdFast?: number;
    macdSlow?: number;
    macdSignal?: number;
    macdProperty?: 'macd' | 'signal' | 'hist';
  },
): Float64Array {
  const prices = extractClosePricesFloat64(input);

  switch (type) {
    case 'SMA':
      return calculateSMAFloat64Series(prices, params.period || 14);
    case 'EMA':
      return calculateEMAFloat64Series(prices, params.period || 14);
    case 'RSI':
      return calculateRSIFloat64Series(prices, params.period || 14);
    case 'MACD': {
      const fast = params.macdFast || 12;
      const slow = params.macdSlow || 26;
      const sig = params.macdSignal || 9;
      const macdRes = calculateMACDFloat64Series(prices, fast, slow, sig);
      if (params.macdProperty === 'signal') return macdRes.signal;
      if (params.macdProperty === 'hist') return macdRes.histogram;
      return macdRes.macd;
    }
    case 'PRICE':
      return prices;
    default: {
      const nanArr = new Float64Array(prices.length);
      nanArr.fill(Number.NaN);
      return nanArr;
    }
  }
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
  const series = getIndicatorSeriesFloat64(input, type, params);
  return float64ToNullableArray(series);
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

export function evaluateCondition(
  prices: KlineInput,
  cond: MAConditionDto | NormalizedCondition,
): boolean {
  const norm = isNormalizedCondition(cond) ? cond : normalizeCondition(cond);
  const closes = extractClosePricesFloat64(prices);

  const series1 = getIndicatorSeriesFloat64(closes, norm.type, {
    period: norm.period,
    macdFast: norm.macdFast,
    macdSlow: norm.macdSlow,
    macdSignal: norm.macdSignal,
    macdProperty: norm.macdProperty,
  });

  const idx1 = series1.length - 1;
  if (idx1 < 0) return false;

  const val1 = series1[idx1];
  if (val1 === undefined || Number.isNaN(val1)) {
    return false;
  }

  let val2: number | null = null;
  if (norm.compareType === 'value') {
    val2 = norm.compareValue !== undefined ? norm.compareValue : null;
  } else {
    const compType = norm.compareIndicatorType || norm.type;
    const compPeriod = norm.comparePeriod !== undefined ? norm.comparePeriod : norm.period;
    const series2 = getIndicatorSeriesFloat64(closes, compType, {
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

  if (val2 === null || val2 === undefined || Number.isNaN(val2)) {
    return false;
  }

  if (norm.operator === 'gt') {
    return val1 > val2;
  } else if (norm.operator === 'lt') {
    return val1 < val2;
  }

  return false;
}

/**
 * Scan signals across a price series and return a compact Uint8Array mask (1 = matched, 0 = not matched).
 */
export function scanSignalsMask(
  prices: KlineInput | Float64Array,
  cond: NormalizedCondition,
): Uint8Array {
  const closes = extractClosePricesFloat64(prices);
  const series1 = getIndicatorSeriesFloat64(closes, cond.type, {
    period: cond.period,
    macdFast: cond.macdFast,
    macdSlow: cond.macdSlow,
    macdSignal: cond.macdSignal,
    macdProperty: cond.macdProperty,
  });

  const len = series1.length;
  if (len === 0) {
    return new Uint8Array(0);
  }

  let series2: Float64Array | null = null;
  if (cond.compareType !== 'value') {
    const compType = cond.compareIndicatorType || cond.type;
    const compPeriod = cond.comparePeriod !== undefined ? cond.comparePeriod : cond.period;
    series2 = getIndicatorSeriesFloat64(closes, compType, {
      period: compPeriod,
      macdFast: cond.compareMacdFast !== undefined ? cond.compareMacdFast : cond.macdFast,
      macdSlow: cond.compareMacdSlow !== undefined ? cond.compareMacdSlow : cond.macdSlow,
      macdSignal: cond.compareMacdSignal !== undefined ? cond.compareMacdSignal : cond.macdSignal,
      macdProperty: cond.compareMacdProperty || cond.macdProperty,
    });
  }

  if (isRustCoreActive()) {
    return scanConditionMask(
      series1,
      series2,
      cond.compareType,
      cond.compareValue !== undefined ? cond.compareValue : Number.NaN,
      cond.operator,
    );
  }

  const mask = new Uint8Array(len);
  for (let idx = 0; idx < len; idx++) {
    const val1 = series1[idx];
    if (Number.isNaN(val1)) continue;

    const val2 =
      cond.compareType === 'value'
        ? cond.compareValue !== undefined
          ? cond.compareValue
          : Number.NaN
        : series2
          ? series2[idx]
          : Number.NaN;

    if (Number.isNaN(val2)) continue;

    if (cond.operator === 'gt' && val1 > val2) {
      mask[idx] = 1;
    } else if (cond.operator === 'lt' && val1 < val2) {
      mask[idx] = 1;
    }
  }
  return mask;
}

export function scanSignals(prices: KlineInput, cond: NormalizedCondition): number[] {
  const mask = scanSignalsMask(prices, cond);
  const signalIndices: number[] = [];
  for (let idx = 0; idx < mask.length; idx++) {
    if (mask[idx] === 1) {
      signalIndices.push(idx);
    }
  }
  return signalIndices;
}
