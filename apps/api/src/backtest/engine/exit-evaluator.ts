import { OHLCVKline } from '../../market/types';
import { BacktestConfig, BacktestState, Position } from './types';

export class ExitEvaluator {
  private static readonly DEFAULT_MMR = 0.004;

  /**
   * 評估持倉是否應平倉 (強平 -> 固定停損 -> 固定停利 -> 訊號平倉)
   * @param isReverseSignal 當前 K 棒是否觸發指標反向平倉訊號
   * @returns boolean 表示倉位是否完全平倉 (true = 已完全平倉，false = 仍有持倉)
   */
  static evaluateAndClosePosition(
    state: BacktestState,
    pos: Position,
    kline: OHLCVKline,
    config: BacktestConfig,
    isReverseSignal = false,
  ): boolean {
    pos.holdingCandles = (pos.holdingCandles || 0) + 1;
    const isLong = pos.side === 'LONG';

    // 1. 強平檢查 (Liquidation)
    const MMR = this.DEFAULT_MMR;
    const liqPrice = isLong
      ? pos.entryPrice * (1 - 1 / pos.leverage + MMR)
      : pos.entryPrice * (1 + 1 / pos.leverage - MMR);

    let isLiquidated = false;
    if (isLong && kline.low <= liqPrice) {
      isLiquidated = true;
    } else if (!isLong && kline.high >= liqPrice) {
      isLiquidated = true;
    }

    if (isLiquidated) {
      const pnl = -pos.margin;
      state.currentBalance += pos.margin + pnl;
      state.trades.push({
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        exitPrice: liqPrice,
        entryTime: pos.entryTime,
        exitTime: kline.openTime,
        pnl,
        pnlPercent: -1,
        reason: 'LIQUIDATION',
      });
      return true;
    }

    // 2. 基準固定百分比停損 (Fixed Stop Loss)
    if (pos.slPrice > 0) {
      if (isLong && kline.low <= pos.slPrice) {
        this.executeClose(state, pos, pos.slPrice, kline.openTime, 'SL', config.takerFeeRate, config.slippage);
        return true;
      } else if (!isLong && kline.high >= pos.slPrice) {
        this.executeClose(state, pos, pos.slPrice, kline.openTime, 'SL', config.takerFeeRate, config.slippage);
        return true;
      }
    }

    // 3. 基準固定百分比停利 (Fixed Take Profit)
    if (pos.tpPrice > 0) {
      if (isLong && kline.high >= pos.tpPrice) {
        this.executeClose(state, pos, pos.tpPrice, kline.openTime, 'TP', config.takerFeeRate, config.slippage);
        return true;
      } else if (!isLong && kline.low <= pos.tpPrice) {
        this.executeClose(state, pos, pos.tpPrice, kline.openTime, 'TP', config.takerFeeRate, config.slippage);
        return true;
      }
    }

    // 4. 指標訊號反向平倉 (Signal Reverse Exit - 讓利潤奔跑)
    const signalExitActive = config.exitConditionMode
      ? config.exitConditionMode !== 'NONE'
      : config.useSignalExit !== false;
    if (signalExitActive && isReverseSignal) {
      this.executeClose(state, pos, kline.close, kline.openTime, 'SIGNAL_EXIT', config.takerFeeRate, config.slippage);
      return true;
    }

    return false;
  }

  public static executeClose(
    state: BacktestState,
    pos: Position,
    baseExitPrice: number,
    exitTime: number,
    reason: string,
    feeRate: number,
    slippagePercent: number,
  ): void {
    const slippageFactor = slippagePercent / 100;
    const actualExitPrice = pos.side === 'LONG'
      ? baseExitPrice * (1 - slippageFactor)
      : baseExitPrice * (1 + slippageFactor);

    const exitValue = pos.quantity * actualExitPrice;
    const exitFee = exitValue * feeRate;

    const rawPnL = pos.side === 'LONG'
      ? exitValue - pos.quantity * pos.entryPrice
      : pos.quantity * pos.entryPrice - exitValue;

    const netPnL = rawPnL - exitFee;

    state.currentBalance += pos.margin + netPnL;

    state.trades.push({
      symbol: pos.symbol,
      side: pos.side,
      entryPrice: pos.entryPrice,
      exitPrice: actualExitPrice,
      entryTime: pos.entryTime,
      exitTime,
      pnl: netPnL,
      pnlPercent: netPnL / pos.margin,
      reason,
    });
  }
}
