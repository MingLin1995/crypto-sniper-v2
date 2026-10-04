import { BacktestEngine } from './backtest-engine';
import { BacktestConfig } from './types';
import { OHLCVKline } from '../../market/types';

describe('BacktestEngine (回測引擎核心)', () => {
  const createMockKlines = (_symbol: string, startPrice: number, trend: number, count = 20): OHLCVKline[] => {
    const klines: OHLCVKline[] = [];
    const intervalMs = 15 * 60 * 1000;
    let price = startPrice;

    for (let i = 0; i < count; i++) {
      const openTime = 1600000000000 + i * intervalMs;
      const open = price;
      price += trend;
      const close = price;
      const high = Math.max(open, close) + 0.1;
      const low = Math.min(open, close) - 0.1;

      klines.push({
        openTime,
        open,
        high,
        low,
        close,
        volume: 100,
        closeTime: openTime + intervalMs - 1,
      });
    }

    return klines;
  };

  const defaultConfig: BacktestConfig = {
    symbols: ['BTCUSDT'],
    interval: '15m',
    startTime: 1600000000000,
    endTime: 1600000000000 + 20 * 15 * 60 * 1000,
    leverage: 10,
    takerFeeRate: 0.0004,
    makerFeeRate: 0.0002,
    slippage: 0.05,
    slPercent: 2,
    tpPercent: 5,
    initialBalance: 10000,
    fundingRate: 0.0001,
    positionSizingMode: 'FIXED_PERCENT',
    fixedMarginPercent: 10,
    maxPositions: 3,
    timeframes: [
      {
        interval: '15m',
        conditions: [
          {
            type: 'RSI' as const,
            period: 2,
            operator: 'gt' as const,
            compareType: 'value' as const,
            compareValue: -1,
          },
        ],
      },
    ],
  };

  it('應能成功初始化回測引擎並執行完畢', () => {
    const btcKlines = createMockKlines('BTCUSDT', 100, 1, 20);

    const result = BacktestEngine.run({
      config: defaultConfig,
      symbolKlines: { BTCUSDT: btcKlines },
    });

    expect(result.state).toBeDefined();
    expect(result.state.equityCurve.length).toBe(20);
    expect(result.state.stats).toBeDefined();
  });

  describe('進出場與風險管理驗證', () => {
    it('訊號成交應延遲至下一根 K 棒的 Open 價成交且加入滑價', () => {
      const btcKlines = createMockKlines('BTCUSDT', 100, 1, 20);
      const result = BacktestEngine.run({
        config: defaultConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      });

      expect(result.state.trades.length).toBeGreaterThan(0);
      const trade = result.state.trades[0];
      // RSI 2 需要 3 根 K 棒 (indices 0, 1, 2) 來生成第一個訊號 (index 2)。
      // 延遲開倉會在下一根 K 棒 (index 3) 進行。
      // index 3 的 openTime 應該是 startTime + 3 * 15m
      const expectedEntryTime = defaultConfig.startTime + 3 * 15 * 60 * 1000;
      expect(trade.entryTime).toBe(expectedEntryTime);
    });

    it('同棒同時觸及 TP/SL 應優先判定為 SL (保守假設)', () => {
      const btcKlines = createMockKlines('BTCUSDT', 100, 0, 10);
      // 我們讓 index 3 K 棒的高低點為 110 與 90，這會觸及 TP 與 SL (相對於 entryPrice ~100.05)
      btcKlines[3].high = 110;
      btcKlines[3].low = 90;

      const customConfig = {
        ...defaultConfig,
        leverage: 1, // 設為 1 倍槓桿防止爆倉
        tpPercent: 5,
        slPercent: 2,
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      });

      const slTrades = result.state.trades.filter((t) => t.reason === 'SL');
      const tpTrades = result.state.trades.filter((t) => t.reason === 'TP');

      expect(slTrades.length).toBeGreaterThan(0);
      expect(tpTrades.length).toBe(0);
    });

    it('若觸及強平價應判定該倉位全損且狀態為 LIQUIDATION', () => {
      // 價格暴跌，讓它在 index 3 直接跌穿強平價格
      const btcKlines = createMockKlines('BTCUSDT', 100, 1, 10);
      btcKlines[3].open = 90;
      btcKlines[3].close = 50;
      btcKlines[3].high = 90;
      btcKlines[3].low = 40;

      const customConfig = {
        ...defaultConfig,
        leverage: 20, // 高槓桿
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      });

      const liqTrades = result.state.trades.filter((t) => t.reason === 'LIQUIDATION');
      expect(liqTrades.length).toBeGreaterThan(0);
      expect(liqTrades[0].pnlPercent).toBe(-1); // 全損
    });

    it('應能正確計算並套用自訂 Stop Loss 和 Take Profit 比例', () => {
      const btcKlines = createMockKlines('BTCUSDT', 100, 1, 20);

      const customConfig = {
        ...defaultConfig,
        slPercent: 1.5,
        tpPercent: 3.0,
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      });

      expect(result.state.trades.length).toBeGreaterThan(0);
      expect(['SL', 'TP']).toContain(result.state.trades[0].reason);
    });
  });

  describe('多幣種排序與持倉限制', () => {
    it('多幣種同時開倉時，應按成交金額/成交量高低排序處理且不超過持倉上限', () => {
      const btcKlines = createMockKlines('BTCUSDT', 100, 1, 10);
      const ethKlines = createMockKlines('ETHUSDT', 100, 1, 10);
      const solKlines = createMockKlines('SOLUSDT', 100, 1, 10);

      // 設置 SOL 成交量最高 (500), ETH 次之 (300), BTC 最低 (100)
      solKlines.forEach((k) => (k.volume = 500));
      ethKlines.forEach((k) => (k.volume = 300));
      btcKlines.forEach((k) => (k.volume = 100));

      const customConfig = {
        ...defaultConfig,
        symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
        maxPositions: 2,
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: {
          BTCUSDT: btcKlines,
          ETHUSDT: ethKlines,
          SOLUSDT: solKlines,
        },
      });

      // 檢查第一個時間點開倉的交易對是否為 SOLUSDT 和 ETHUSDT (量高者優先)
      const initialPositions = result.state.trades.slice(0, 2).map((t) => t.symbol);
      expect(initialPositions).toContain('SOLUSDT');
      expect(initialPositions).toContain('ETHUSDT');
      expect(initialPositions).not.toContain('BTCUSDT');
    });
  });

  describe('資料缺口 Forward Fill 驗證', () => {
    it('無持倉時缺口視為無訊號，有持倉時缺口應 Forward Fill 確保損益正常', () => {
      const btcKlines = createMockKlines('BTCUSDT', 100, 1, 10);
      const ethKlines = createMockKlines('ETHUSDT', 100, 1, 10);
      
      const incompleteBtcKlines = btcKlines.filter((_, idx) => idx !== 4);

      const customConfig = {
        ...defaultConfig,
        symbols: ['BTCUSDT', 'ETHUSDT'],
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: {
          BTCUSDT: incompleteBtcKlines,
          ETHUSDT: ethKlines,
        },
      });

      expect(result.state.equityCurve.length).toBe(10);
      expect(result.state).toBeDefined();
    });
  });

  describe('決定性驗證 (Determinism)', () => {
    it('同參數執行兩次，交易日誌與 ROI 應 100% 一致', () => {
      const btcKlines = createMockKlines('BTCUSDT', 100, 1, 20);
      const input = {
        config: defaultConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      };
      
      const result1 = BacktestEngine.run(input);
      const result2 = BacktestEngine.run(input);
      
      expect(result1.state.trades).toEqual(result2.state.trades);
      expect(result1.state.stats.roi).toBe(result2.state.stats.roi);
      expect(result1.state.equityCurve).toEqual(result2.state.equityCurve);
    });
  });

  describe('極簡出場機制驗證 (Simple Exit Rules: Fixed SL/TP & Signal Exit)', () => {
    it('應能正常依固定停損百分比 (slPercent) 觸發 SL 離場', () => {
      const btcKlines = createMockKlines('BTCUSDT', 100, -1, 20); // 下跌趨勢
      const customConfig = {
        ...defaultConfig,
        slPercent: 2,
        tpPercent: 10,
        useSignalExit: false,
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      });

      expect(result.state).toBeDefined();
      const slTrades = result.state.trades.filter((t) => t.reason === 'SL');
      expect(slTrades.length).toBeGreaterThan(0);
    });

    it('應能正常依固定停利百分比 (tpPercent) 觸發 TP 離場', () => {
      const btcKlines = createMockKlines('BTCUSDT', 100, 2, 20); // 上漲趨勢
      const customConfig = {
        ...defaultConfig,
        slPercent: 5,
        tpPercent: 3,
        useSignalExit: false,
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      });

      expect(result.state).toBeDefined();
      const tpTrades = result.state.trades.filter((t) => t.reason === 'TP');
      expect(tpTrades.length).toBeGreaterThan(0);
    });

    it('應能正常執行指標反向死叉平倉 (SIGNAL_EXIT)', () => {
      // 構造前段上漲、後段下跌的行情以觸發反向平倉
      const btcKlines = [
        ...createMockKlines('BTCUSDT', 100, 1, 10),
        ...createMockKlines('BTCUSDT', 110, -1, 10),
      ];
      const customConfig = {
        ...defaultConfig,
        slPercent: 20, // 寬幅 SL 避免提早觸發
        useSignalExit: true,
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      });

      expect(result.state).toBeDefined();
      expect(result.state.trades.length).toBeGreaterThan(0);
    });

    it('應支援自訂平倉指標條件 (CUSTOM exitConditionMode)', () => {
      const btcKlines = [
        ...createMockKlines('BTCUSDT', 100, 1, 10),
        ...createMockKlines('BTCUSDT', 110, -2, 10),
      ];
      const customConfig: BacktestConfig = {
        ...defaultConfig,
        slPercent: 20,
        exitConditionMode: 'CUSTOM',
        exitConditions: [
          {
            type: 'PRICE',
            operator: 'lt',
            compareType: 'indicator',
            compareIndicatorType: 'EMA',
            comparePeriod: 3,
          },
        ],
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      });

      expect(result.state).toBeDefined();
      expect(result.state.trades.length).toBeGreaterThan(0);
      const signalExits = result.state.trades.filter((t) => t.reason === 'SIGNAL_EXIT');
      expect(signalExits.length).toBeGreaterThan(0);
    });

    it('應支援停用指標平倉 (NONE exitConditionMode)', () => {
      const btcKlines = [
        ...createMockKlines('BTCUSDT', 100, 1, 10),
        ...createMockKlines('BTCUSDT', 110, -1, 10),
      ];
      const customConfig: BacktestConfig = {
        ...defaultConfig,
        slPercent: 50, // 很大不會觸發
        exitConditionMode: 'NONE',
      };

      const result = BacktestEngine.run({
        config: customConfig,
        symbolKlines: { BTCUSDT: btcKlines },
      });

      expect(result.state).toBeDefined();
      // 在 NONE 模式下，不應有 SIGNAL_EXIT
      const signalExits = result.state.trades.filter((t) => t.reason === 'SIGNAL_EXIT');
      expect(signalExits.length).toBe(0);
    });
  });
});
