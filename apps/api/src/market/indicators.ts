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
