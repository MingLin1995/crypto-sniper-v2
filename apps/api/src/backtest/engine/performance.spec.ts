import { PerformanceCalculator } from './performance';
import { CompletedTrade } from './types';

describe('PerformanceCalculator (回測績效計算器)', () => {
  const mockEquityCurve = [
    { timestamp: 1000, equity: 10000 },
    { timestamp: 2000, equity: 10500 },
    { timestamp: 3000, equity: 9500 },
    { timestamp: 4000, equity: 11000 },
    { timestamp: 5000, equity: 12000 },
  ];

  it('在無交易記錄時應回傳基準統計 (0 trades)', () => {
    const stats = PerformanceCalculator.calculate(
      10000, // initial
      12000, // final
      mockEquityCurve,
      [],
      '1d',
    );

    expect(stats.totalTrades).toBe(0);
    expect(stats.roi).toBeCloseTo(0.2, 4); // 12000/10000 - 1
    expect(stats.winRate).toBe(0);
    expect(stats.profitFactor).toBe(0);
    // Peak is 10500 then dropped to 9500 => DD = (10500 - 9500) / 10500 = 1000 / 10500 ≈ 0.0952
    expect(stats.maxDrawdown).toBeGreaterThan(0.09);
    expect(stats.maxDrawdownDuration).toBeGreaterThan(0);
  });

  it('應正確計算勝率、盈虧比與最大連續勝負', () => {
    const trades: CompletedTrade[] = [
      {
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 50000,
        exitPrice: 52000,
        entryTime: 1000,
        exitTime: 2000,
        pnl: 400,
        pnlPercent: 0.4,
        reason: 'TP',
      },
      {
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 52000,
        exitPrice: 54000,
        entryTime: 2000,
        exitTime: 3000,
        pnl: 600,
        pnlPercent: 0.6,
        reason: 'TP',
      },
      {
        symbol: 'BTCUSDT',
        side: 'SHORT',
        entryPrice: 54000,
        exitPrice: 55000,
        entryTime: 3000,
        exitTime: 4000,
        pnl: -200,
        pnlPercent: -0.2,
        reason: 'SL',
      },
    ];

    const stats = PerformanceCalculator.calculate(
      10000,
      10800,
      mockEquityCurve,
      trades,
      '1h',
    );

    expect(stats.totalTrades).toBe(3);
    expect(stats.winRate).toBeCloseTo(2 / 3, 4);
    // totalProfit = 1000, totalLoss = 200 => profitFactor = 1000 / 200 = 5
    expect(stats.profitFactor).toBe(5);
    expect(stats.maxConsecutiveWins).toBe(2);
    expect(stats.maxConsecutiveLosses).toBe(1);
    expect(stats.avgHoldDuration).toBe(1000); // 各持倉 1000 ms
    expect(stats.sharpeRatio).toBeDefined();
    expect(stats.calmarRatio).toBeDefined();
  });

  it('全部盈利且無虧損時 profitFactor 應為 999 容錯值', () => {
    const trades: CompletedTrade[] = [
      {
        symbol: 'ETHUSDT',
        side: 'LONG',
        entryPrice: 3000,
        exitPrice: 3300,
        entryTime: 1000,
        exitTime: 2000,
        pnl: 500,
        pnlPercent: 0.5,
        reason: 'TP',
      },
    ];

    const stats = PerformanceCalculator.calculate(
      10000,
      10500,
      mockEquityCurve,
      trades,
      '4h',
    );

    expect(stats.profitFactor).toBe(999);
    expect(stats.winRate).toBe(1);
    expect(stats.maxConsecutiveWins).toBe(1);
    expect(stats.maxConsecutiveLosses).toBe(0);
  });
});
