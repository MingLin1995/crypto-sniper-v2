import { CompletedTrade, PerformanceStats } from './types';

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

    if (totalTrades === 0) {
      // 計算 maxDrawdown 與 maxDrawdownDuration 即使沒有交易 (買入並持有期間或一直空倉)
      let peak = initialBalance;
      let maxDrawdown = 0;
      let currentPeakIdx = 0;
      let maxDrawdownDuration = 0;

      for (let i = 0; i < equityCurve.length; i++) {
        const eq = equityCurve[i].equity;
        if (eq > peak) {
          peak = eq;
          currentPeakIdx = i;
        } else {
          const dd = (peak - eq) / peak;
          maxDrawdown = Math.max(maxDrawdown, dd);
          const ddDuration = i - currentPeakIdx;
          maxDrawdownDuration = Math.max(maxDrawdownDuration, ddDuration);
        }
      }

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

    // 2. 勝率與盈虧
    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl <= 0);
    const winRate = winningTrades.length / totalTrades;

    const totalProfit = winningTrades.reduce((acc, t) => acc + t.pnl, 0);
    const totalLoss = losingTrades.reduce((acc, t) => acc + Math.abs(t.pnl), 0);
    const profitFactor = totalLoss === 0 ? (totalProfit > 0 ? 999 : 0) : totalProfit / totalLoss;

    // 3. 最大連續盈虧
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const t of trades) {
      if (t.pnl > 0) {
        currentWins++;
        currentLosses = 0;
        maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
      } else {
        currentLosses++;
        currentWins = 0;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
      }
    }

    // 4. 平均持倉時間
    const totalDuration = trades.reduce((acc, t) => acc + (t.exitTime - t.entryTime), 0);
    const avgHoldDuration = totalDuration / totalTrades;

    // 5. 權益曲線分析 (MDD, Sharpe, Calmar)
    let peak = initialBalance;
    let maxDrawdown = 0;
    let currentPeakIdx = 0;
    let maxDrawdownDuration = 0;

    for (let i = 0; i < equityCurve.length; i++) {
      const eq = equityCurve[i].equity;
      if (eq > peak) {
        peak = eq;
        currentPeakIdx = i;
      } else {
        const dd = (peak - eq) / peak;
        maxDrawdown = Math.max(maxDrawdown, dd);
        const ddDuration = i - currentPeakIdx;
        maxDrawdownDuration = Math.max(maxDrawdownDuration, ddDuration);
      }
    }

    // Sharpe Ratio
    let sharpeRatio = 0;
    if (equityCurve.length > 1) {
      const returns: number[] = [];
      for (let i = 1; i < equityCurve.length; i++) {
        const prev = equityCurve[i - 1].equity;
        const curr = equityCurve[i].equity;
        returns.push(prev === 0 ? 0 : (curr - prev) / prev);
      }

      const avgReturn = returns.reduce((acc, val) => acc + val, 0) / returns.length;
      const variance = returns.reduce((acc, val) => acc + Math.pow(val - avgReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0) {
        sharpeRatio = (avgReturn / stdDev) * Math.sqrt(N);
      }
    }

    // Calmar Ratio
    const calmarRatio = maxDrawdown === 0 ? (annualizedRoi > 0 ? 999 : 0) : annualizedRoi / maxDrawdown;

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
      case '5m': return 105120;
      case '15m': return 35040;
      case '30m': return 17520;
      case '1h': return 8760;
      case '2h': return 4380;
      case '4h': return 2190;
      case '1d': return 365;
      case '1w': return 52;
      case '1M': return 12;
      default: return 365;
      // 依合約時間週期換算
    }
  }
}
