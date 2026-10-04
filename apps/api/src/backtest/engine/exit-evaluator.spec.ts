import { ExitEvaluator } from './exit-evaluator';
import { BacktestConfig, BacktestState, Position } from './types';
import { OHLCVKline } from '../../market/types';

describe('ExitEvaluator (平倉與風控評估器)', () => {
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
    slippage: 0,
    makerFeeRate: 0.0002,
    takerFeeRate: 0.0005,
    timeframes: [],
  };

  const createMockKline = (low: number, high: number, close: number): OHLCVKline => ({
    openTime: 1500,
    open: (low + high) / 2,
    high,
    low,
    close,
    volume: 100,
    closeTime: 1600,
  });

  let state: BacktestState;
  let longPos: Position;
  let shortPos: Position;

  beforeEach(() => {
    state = {
      initialBalance: 10000,
      currentBalance: 9000,
      equity: 10000,
      positions: [],
      trades: [],
      equityCurve: [],
      stats: {} as any,
    };

    longPos = {
      symbol: 'BTCUSDT',
      side: 'LONG',
      entryPrice: 50000,
      entryTime: 1000,
      margin: 1000,
      leverage: 10,
      quantity: 0.2, // 1000 * 10 / 50000 = 0.2
      slPrice: 49000,
      tpPrice: 52000,
      unrealizedPnL: 0,
    };

    shortPos = {
      symbol: 'BTCUSDT',
      side: 'SHORT',
      entryPrice: 50000,
      entryTime: 1000,
      margin: 1000,
      leverage: 10,
      quantity: 0.2,
      slPrice: 51000,
      tpPrice: 48000,
      unrealizedPnL: 0,
    };
  });

  it('多頭觸發強平價時應平倉並記錄 LIQUIDATION', () => {
    // leverage 10, MMR 0.004 => liqPrice = 50000 * (1 - 0.1 + 0.004) = 50000 * 0.904 = 45200
    const kline = createMockKline(45000, 48000, 46000);
    const closed = ExitEvaluator.evaluateAndClosePosition(state, longPos, kline, baseConfig);

    expect(closed).toBe(true);
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0].reason).toBe('LIQUIDATION');
    expect(state.trades[0].pnl).toBe(-1000); // 損失全部保證金
  });

  it('多頭價格跌破停損價時應觸發 SL 平倉', () => {
    // slPrice = 49000
    const kline = createMockKline(48800, 49800, 49200);
    const closed = ExitEvaluator.evaluateAndClosePosition(state, longPos, kline, baseConfig);

    expect(closed).toBe(true);
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0].reason).toBe('SL');
    expect(state.trades[0].exitPrice).toBe(49000);
  });

  it('空頭價格突破停損價時應觸發 SL 平倉', () => {
    // slPrice = 51000
    const kline = createMockKline(50500, 51200, 50800);
    const closed = ExitEvaluator.evaluateAndClosePosition(state, shortPos, kline, baseConfig);

    expect(closed).toBe(true);
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0].reason).toBe('SL');
    expect(state.trades[0].exitPrice).toBe(51000);
  });

  it('多頭價格達到停利價時應觸發 TP 平倉', () => {
    // tpPrice = 52000
    const kline = createMockKline(51000, 52500, 52200);
    const closed = ExitEvaluator.evaluateAndClosePosition(state, longPos, kline, baseConfig);

    expect(closed).toBe(true);
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0].reason).toBe('TP');
    expect(state.trades[0].exitPrice).toBe(52000);
    expect(state.trades[0].pnl).toBeGreaterThan(0);
  });

  it('反向訊號觸發且未達到 SL/TP 時應觸發 SIGNAL_EXIT 平倉', () => {
    // kline 區間 49500 - 50500 (未觸及 49000 或 52000)
    const kline = createMockKline(49500, 50500, 50200);
    const closed = ExitEvaluator.evaluateAndClosePosition(
      state,
      longPos,
      kline,
      baseConfig,
      true, // isReverseSignal
    );

    expect(closed).toBe(true);
    expect(state.trades).toHaveLength(1);
    expect(state.trades[0].reason).toBe('SIGNAL_EXIT');
    expect(state.trades[0].exitPrice).toBe(50200); // 以收盤價平倉
  });

  it('未達到任何平倉條件時應保持持倉 (回傳 false)', () => {
    const kline = createMockKline(49500, 50500, 50200);
    const closed = ExitEvaluator.evaluateAndClosePosition(state, longPos, kline, baseConfig, false);

    expect(closed).toBe(false);
    expect(state.trades).toHaveLength(0);
    expect(longPos.holdingCandles).toBe(1);
  });
});
