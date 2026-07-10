/**
 * 計算簡單移動平均線 (SMA)
 * @param prices 收盤價陣列
 * @param period 週期
 */
export function calculateSMA(prices: number[], period: number): (number | null)[] {
  if (prices.length < period || period <= 0) {
    return Array(prices.length).fill(null);
  }
  const sma: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i];
    if (i >= period) {
      sum -= prices[i - period];
    }
    if (i >= period - 1) {
      sma.push(sum / period);
    } else {
      sma.push(null);
    }
  }
  return sma;
}

/**
 * 計算指數移動平均線 (EMA)
 * @param prices 收盤價陣列
 * @param period 週期
 */
export function calculateEMA(prices: number[], period: number): (number | null)[] {
  if (prices.length < period || period <= 0) {
    return Array(prices.length).fill(null);
  }
  const ema: (number | null)[] = Array(prices.length).fill(null);

  // 第一個 EMA 值採用前 period 個收盤價的簡單平均值 (SMA) 作為種子值
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  const seedSMA = sum / period;
  ema[period - 1] = seedSMA;

  const k = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    // EMA_t = Price_t * k + EMA_{t-1} * (1 - k)
    ema[i] = prices[i] * k + (ema[i - 1] as number) * (1 - k);
  }
  return ema;
}

/**
 * 計算相對強弱指標 (RSI)
 * @param prices 收盤價陣列
 * @param period 週期
 */
export function calculateRSI(prices: number[], period: number): (number | null)[] {
  if (prices.length <= period || period <= 0) {
    return Array(prices.length).fill(null);
  }
  const rsi: (number | null)[] = Array(prices.length).fill(null);

  let avgGain = 0;
  let avgLoss = 0;

  // 第一個 RSI 的平均漲跌幅計算
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

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    // Wilder's smoothing 算法
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

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
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
  const macd: (number | null)[] = Array(prices.length).fill(null);
  const signal: (number | null)[] = Array(prices.length).fill(null);
  const histogram: (number | null)[] = Array(prices.length).fill(null);

  if (prices.length < slowPeriod) {
    return { macd, signal, histogram };
  }

  const emaFast = calculateEMA(prices, fastPeriod);
  const emaSlow = calculateEMA(prices, slowPeriod);

  // 1. 計算 MACD 線
  for (let i = 0; i < prices.length; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    if (f !== null && s !== null) {
      macd[i] = f - s;
    }
  }

  // 2. 計算訊號線 (MACD 線的 EMA)
  const firstValidMacdIdx = macd.findIndex((val) => val !== null);
  if (firstValidMacdIdx === -1 || prices.length - firstValidMacdIdx < signalPeriod) {
    return { macd, signal, histogram };
  }

  // 訊號線的第一個種子值 (SMA)
  let sum = 0;
  for (let i = firstValidMacdIdx; i < firstValidMacdIdx + signalPeriod; i++) {
    sum += macd[i] as number;
  }
  const seedSMA = sum / signalPeriod;
  const signalStartIdx = firstValidMacdIdx + signalPeriod - 1;
  signal[signalStartIdx] = seedSMA;

  const k = 2 / (signalPeriod + 1);
  for (let i = signalStartIdx + 1; i < prices.length; i++) {
    const m = macd[i];
    const prevSig = signal[i - 1];
    if (m !== null && prevSig !== null) {
      signal[i] = m * k + prevSig * (1 - k);
    }
  }

  // 3. 計算直方圖 (Histogram)
  for (let i = 0; i < prices.length; i++) {
    const m = macd[i];
    const sig = signal[i];
    if (m !== null && sig !== null) {
      histogram[i] = m - sig;
    }
  }

  return { macd, signal, histogram };
}
