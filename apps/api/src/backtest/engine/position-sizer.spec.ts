import { PositionSizer } from './position-sizer';
import { BacktestConfig } from './types';

describe('PositionSizer (倉位計算器)', () => {
  const baseConfig: BacktestConfig = {
    symbols: ['BTCUSDT'],
    interval: '1h',
    startTime: 1000,
    endTime: 2000,
    initialBalance: 10000,
    fundingRate: 0.0001,
    leverage: 10,
    positionSizingMode: 'FIXED_PERCENT',
    fixedMarginPercent: 10,
    riskPercentPerTrade: 2,
    slPercent: 2,
    tpPercent: 4,
    slippage: 0.05,
    makerFeeRate: 0.0002,
    takerFeeRate: 0.0005,
    timeframes: [],
  };

  describe('FIXED_PERCENT 模式', () => {
    it('應根據 fixedMarginPercent 正確計算保證金與合約數量', () => {
      const res = PositionSizer.calculateSize(
        baseConfig,
        10000, // currentBalance
        10000, // currentEquity
        50000, // entryPrice
        49000, // slPrice
      );

      expect(res.modeUsed).toBe('FIXED_PERCENT');
      expect(res.margin).toBe(1000); // 10000 * 10%
      // quantity = (margin * leverage) / entryPrice = (1000 * 10) / 50000 = 0.2
      expect(res.quantity).toBe(0.2);
      expect(res.warning).toBeUndefined();
    });

    it('保證金不得超過可用餘額', () => {
      const config: BacktestConfig = { ...baseConfig, fixedMarginPercent: 150 };
      const res = PositionSizer.calculateSize(config, 5000, 5000, 50000, 49000);

      expect(res.margin).toBe(5000);
      expect(res.quantity).toBe((5000 * 10) / 50000);
    });
  });

  describe('RISK_BASED 模式', () => {
    it('應根據停損距離與 riskPercent 正確計算倉位', () => {
      const riskConfig: BacktestConfig = {
        ...baseConfig,
        positionSizingMode: 'RISK_BASED',
        riskPercentPerTrade: 1, // 冒險 1% = 100 USDT
        leverage: 10,
      };

      // entry: 50000, sl: 49000 => priceDiff = 1000
      // riskAmount = 10000 * 1% = 100
      // qty = 100 / 1000 = 0.1
      // margin = (0.1 * 50000) / 10 = 500
      const res = PositionSizer.calculateSize(
        riskConfig,
        10000,
        10000,
        50000,
        49000,
      );

      expect(res.modeUsed).toBe('RISK_BASED');
      expect(res.quantity).toBeCloseTo(0.1, 4);
      expect(res.margin).toBeCloseTo(500, 2);
    });

    it('若未設定有效 SL 價格，應自動降級至 FIXED_PERCENT 模式並提供警示', () => {
      const riskConfig: BacktestConfig = {
        ...baseConfig,
        positionSizingMode: 'RISK_BASED',
      };

      const res = PositionSizer.calculateSize(riskConfig, 10000, 10000, 50000, 0);

      expect(res.modeUsed).toBe('FIXED_PERCENT');
      expect(res.warning).toContain('Downgraded to Fixed Margin Percent');
      expect(res.margin).toBe(1000);
    });
  });

  describe('最小名目價值檢查 (< 5 USDT)', () => {
    it('名目價值小於 5 USDT 時應拒絕開倉並回傳 0', () => {
      const microRes = PositionSizer.calculateSize(
        baseConfig,
        1,
        1,
        50000,
        49000,
      );

      expect(microRes.margin).toBe(0);
      expect(microRes.quantity).toBe(0);
    });
  });
});
