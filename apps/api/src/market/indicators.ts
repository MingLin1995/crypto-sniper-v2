import {
  calculateEMAFloat64,
  calculateMACDFloat64,
  calculateRSIFloat64,
  calculateSMAFloat64,
  float64ToNullableArray,
  isRustCoreActive,
} from './rust-core';

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export interface MACDFloat64Result {
  macd: Float64Array;
  signal: Float64Array;
  histogram: Float64Array;
}

/**
 * Pure TypeScript SMA fallback implementation.
 */
export function calculateSMAFallback(prices: ArrayLike<number>, period: number): (number | null)[] {
  const len = prices.length;
  if (len < period || period <= 0) {
    return Array(len).fill(null);
  }
  const sma: (number | null)[] = new Array(len);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += prices[i];
    if (i >= period) {
      sum -= prices[i - period];
    }
    if (i >= period - 1) {
      sma[i] = sum / period;
    } else {
      sma[i] = null;
    }
  }
  return sma;
}

/**
 * Pure TypeScript EMA fallback implementation.
 */
export function calculateEMAFallback(prices: ArrayLike<number>, period: number): (number | null)[] {
  const len = prices.length;
  if (len < period || period <= 0) {
    return Array(len).fill(null);
  }
  const ema: (number | null)[] = Array(len).fill(null);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / period;

  const k = 2 / (period + 1);
  for (let i = period; i < len; i++) {
    ema[i] = prices[i] * k + (ema[i - 1] as number) * (1 - k);
  }
  return ema;
}

/**
 * Pure TypeScript RSI fallback implementation.
 */
export function calculateRSIFallback(prices: ArrayLike<number>, period: number): (number | null)[] {
  const len = prices.length;
  if (len <= period || period <= 0) {
    return Array(len).fill(null);
  }
  const rsi: (number | null)[] = Array(len).fill(null);

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += -change;
    }
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgGain + avgLoss === 0) {
    rsi[period] = 50;
  } else if (avgLoss === 0) {
    rsi[period] = 100;
  } else {
    rsi[period] = 100 - 100 / (1 + avgGain / avgLoss);
  }

  for (let i = period + 1; i < len; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgGain + avgLoss === 0) {
      rsi[i] = 50;
    } else if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      rsi[i] = 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  return rsi;
}

/**
 * Pure TypeScript MACD fallback implementation.
 */
export function calculateMACDFallback(
  prices: ArrayLike<number>,
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult {
  const len = prices.length;
  const macd: (number | null)[] = Array(len).fill(null);
  const signal: (number | null)[] = Array(len).fill(null);
  const histogram: (number | null)[] = Array(len).fill(null);

  if (len < slowPeriod) {
    return { macd, signal, histogram };
  }

  const emaFast = calculateEMAFallback(prices, fastPeriod);
  const emaSlow = calculateEMAFallback(prices, slowPeriod);

  for (let i = 0; i < len; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    if (f !== null && s !== null) {
      macd[i] = f - s;
    }
  }

  const firstValidMacdIdx = macd.findIndex((val) => val !== null);
  if (firstValidMacdIdx === -1 || signalPeriod <= 0 || len - firstValidMacdIdx < signalPeriod) {
    return { macd, signal, histogram };
  }

  let sum = 0;
  for (let i = firstValidMacdIdx; i < firstValidMacdIdx + signalPeriod; i++) {
    sum += macd[i] as number;
  }
  const seedSMA = sum / signalPeriod;
  const signalStartIdx = firstValidMacdIdx + signalPeriod - 1;
  signal[signalStartIdx] = seedSMA;

  const k = 2 / (signalPeriod + 1);
  for (let i = signalStartIdx + 1; i < len; i++) {
    const m = macd[i];
    const prevSig = signal[i - 1];
    if (m !== null && prevSig !== null) {
      signal[i] = m * k + prevSig * (1 - k);
    }
  }

  for (let i = 0; i < len; i++) {
    const m = macd[i];
    const sig = signal[i];
    if (m !== null && sig !== null) {
      histogram[i] = m - sig;
    }
  }

  return { macd, signal, histogram };
}

function nullableToFloat64(arr: (number | null)[]): Float64Array {
  const out = new Float64Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    out[i] = v === null || v === undefined ? Number.NaN : v;
  }
  return out;
}

/**
 * 計算簡單移動平均線 (SMA) - Float64Array 零箱裝高速版 (優先使用 Rust 核心)
 */
export function calculateSMAFloat64Series(
  prices: Float64Array | readonly number[],
  period: number,
): Float64Array {
  if (isRustCoreActive()) {
    return calculateSMAFloat64(prices, period);
  }
  return nullableToFloat64(calculateSMAFallback(prices, period));
}

/**
 * 計算指數移動平均線 (EMA) - Float64Array 零箱裝高速版 (優先使用 Rust 核心)
 */
export function calculateEMAFloat64Series(
  prices: Float64Array | readonly number[],
  period: number,
): Float64Array {
  if (isRustCoreActive()) {
    return calculateEMAFloat64(prices, period);
  }
  return nullableToFloat64(calculateEMAFallback(prices, period));
}

/**
 * 計算相對強弱指標 (RSI) - Float64Array 零箱裝高速版 (優先使用 Rust 核心)
 */
export function calculateRSIFloat64Series(
  prices: Float64Array | readonly number[],
  period: number,
): Float64Array {
  if (isRustCoreActive()) {
    return calculateRSIFloat64(prices, period);
  }
  return nullableToFloat64(calculateRSIFallback(prices, period));
}

/**
 * 計算 MACD - Float64Array 零箱裝高速版 (優先使用 Rust 核心)
 */
export function calculateMACDFloat64Series(
  prices: Float64Array | readonly number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDFloat64Result {
  if (isRustCoreActive()) {
    return calculateMACDFloat64(prices, fastPeriod, slowPeriod, signalPeriod);
  }
  const res = calculateMACDFallback(prices, fastPeriod, slowPeriod, signalPeriod);
  return {
    macd: nullableToFloat64(res.macd),
    signal: nullableToFloat64(res.signal),
    histogram: nullableToFloat64(res.histogram),
  };
}

/**
 * 計算簡單移動平均線 (SMA)
 * @param prices 收盤價陣列
 * @param period 週期
 */
export function calculateSMA(prices: number[], period: number): (number | null)[] {
  if (isRustCoreActive()) {
    return float64ToNullableArray(calculateSMAFloat64(prices, period));
  }
  return calculateSMAFallback(prices, period);
}

/**
 * 計算指數移動平均線 (EMA)
 * @param prices 收盤價陣列
 * @param period 週期
 */
export function calculateEMA(prices: number[], period: number): (number | null)[] {
  if (isRustCoreActive()) {
    return float64ToNullableArray(calculateEMAFloat64(prices, period));
  }
  return calculateEMAFallback(prices, period);
}

/**
 * 計算相對強弱指標 (RSI)
 * @param prices 收盤價陣列
 * @param period 週期
 */
export function calculateRSI(prices: number[], period: number): (number | null)[] {
  if (isRustCoreActive()) {
    return float64ToNullableArray(calculateRSIFloat64(prices, period));
  }
  return calculateRSIFallback(prices, period);
}

/**
 * 計算平滑異同移動平均線 (MACD)
 * @param prices 收盤價陣列
 * @param fastPeriod 快速 EMA 週期 (預設 12)
 * @param slowPeriod 慢速 EMA 週期 (預設 26)
 * @param signalPeriod 訊號 EMA 週期 (預設 9)
 */
export function calculateMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult {
  if (isRustCoreActive()) {
    const res = calculateMACDFloat64(prices, fastPeriod, slowPeriod, signalPeriod);
    return {
      macd: float64ToNullableArray(res.macd),
      signal: float64ToNullableArray(res.signal),
      histogram: float64ToNullableArray(res.histogram),
    };
  }
  return calculateMACDFallback(prices, fastPeriod, slowPeriod, signalPeriod);
}
