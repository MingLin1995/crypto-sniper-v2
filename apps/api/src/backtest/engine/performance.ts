import { CompletedTrade, PerformanceStats } from './types';
import { calculateEquityCurveMetrics, isRustCoreActive } from '../../market/rust-core';

function computeEquityMetricsFallback(
  equities: Float64Array,
  initialBalance: number,
  annualizationFactor: number,
): { maxDrawdown: number; maxDrawdownDuration: number; sharpeRatio: number } {
  const len = equities.length;
  if (len === 0) {
    return { maxDrawdown: 0, maxDrawdownDuration: 0, sharpeRatio: 0 };
  }

  let peak = initialBalance;
  let maxDrawdown = 0;
  let currentPeakIdx = 0;
  let maxDrawdownDuration = 0;

  for (let i = 0; i < len; i++) {
    const eq = equities[i];
    if (eq > peak) {
      peak = eq;
      currentPeakIdx = i;
    } else {
      const dd = peak !== 0 ? (peak - eq) / peak : 0;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
      }
      const ddDuration = i - currentPeakIdx;
      if (ddDuration > maxDrawdownDuration) {
        maxDrawdownDuration = ddDuration;
      }
    }
  }

  let sharpeRatio = 0;
  if (len > 1) {
    const retCount = len - 1;
    let sumReturns = 0;
    for (let i = 1; i < len; i++) {
      const prev = equities[i - 1];
      const curr = equities[i];
      sumReturns += prev === 0 ? 0 : (curr - prev) / prev;
    }
    const avgReturn = sumReturns / retCount;

    let sumSqDiff = 0;
    for (let i = 1; i < len; i++) {
      const prev = equities[i - 1];
      const curr = equities[i];
      const ret = prev === 0 ? 0 : (curr - prev) / prev;
      const diff = ret - avgReturn;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / retCount);

    if (stdDev > 0) {
      sharpeRatio = (avgReturn / stdDev) * Math.sqrt(annualizationFactor);
    }
  }

  return { maxDrawdown, maxDrawdownDuration, sharpeRatio };
}

export class PerformanceCalculator {
  /**
   * 計算回測最終績效指標
   */
  static calculate(
    initialBalance: number,
    finalEquity: number,
    equityCurve: { timestamp: number; equity: number }[],
    trades: CompletedTrade[],
    interval: string,
  ): PerformanceStats {
    const totalTrades = trades.length;

    const roi = finalEquity / initialBalance - 1;

    // 1. 年化因子
    const N = this.getAnnualizationFactor(interval);
    const totalBars = equityCurve.length;
    const years = Math.max(totalBars / N, 0.0001);

    // CAGR
    let annualizedRoi = 0;
    if (finalEquity > 0) {
      annualizedRoi = Math.pow(finalEquity / initialBalance, 1 / years) - 1;
    } else {
      annualizedRoi = -1;
    }

    // 使用連續 Float64Array + Rust WASM 核心一次算出 MDD、回撤持續期與 Sharpe Ratio
    const equities = new Float64Array(totalBars);
    for (let i = 0; i < totalBars; i++) {
      equities[i] = equityCurve[i].equity;
    }

    const equityMetrics = isRustCoreActive()
      ? calculateEquityCurveMetrics(equities, initialBalance, N)
      : computeEquityMetricsFallback(equities, initialBalance, N);

    const { maxDrawdown, maxDrawdownDuration, sharpeRatio } = equityMetrics;

    if (totalTrades === 0) {
      return {
        roi,
        annualizedRoi,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown,
        sharpeRatio: 0,
        calmarRatio: maxDrawdown === 0 ? 0 : annualizedRoi / maxDrawdown,
        totalTrades: 0,
        avgHoldDuration: 0,
        maxConsecutiveLosses: 0,
        maxConsecutiveWins: 0,
        maxDrawdownDuration,
      };
    }

    // 2. 單次迭代統計勝率、盈虧比、最大連續勝負與平均持倉時間
    let winCount = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;
    let totalDuration = 0;

    for (let i = 0; i < totalTrades; i++) {
      const t = trades[i];
      totalDuration += t.exitTime - t.entryTime;
      if (t.pnl > 0) {
        winCount++;
        totalProfit += t.pnl;
        currentWins++;
        currentLosses = 0;
        if (currentWins > maxConsecutiveWins) {
          maxConsecutiveWins = currentWins;
        }
      } else {
        totalLoss += Math.abs(t.pnl);
        currentLosses++;
        currentWins = 0;
        if (currentLosses > maxConsecutiveLosses) {
          maxConsecutiveLosses = currentLosses;
        }
      }
    }

    const winRate = winCount / totalTrades;
    const profitFactor = totalLoss === 0 ? (totalProfit > 0 ? 999 : 0) : totalProfit / totalLoss;
    const avgHoldDuration = totalDuration / totalTrades;

    // Calmar Ratio
    const calmarRatio =
      maxDrawdown === 0 ? (annualizedRoi > 0 ? 999 : 0) : annualizedRoi / maxDrawdown;

    return {
      roi,
      annualizedRoi,
      winRate,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      calmarRatio,
      totalTrades,
      avgHoldDuration,
      maxConsecutiveLosses,
      maxConsecutiveWins,
      maxDrawdownDuration,
    };
  }

  private static getAnnualizationFactor(interval: string): number {
    switch (interval) {
      case '5m':
        return 105120;
      case '15m':
        return 35040;
      case '30m':
        return 17520;
      case '1h':
        return 8760;
      case '2h':
        return 4380;
      case '4h':
        return 2190;
      case '1d':
        return 365;
      case '1w':
        return 52;
      case '1M':
        return 12;
      default:
        return 365;
      // 依合約時間週期換算
    }
  }
}
