import { BacktestConfig } from './types';

export interface SizingResult {
  margin: number;
  quantity: number;
  modeUsed: 'FIXED_PERCENT' | 'RISK_BASED';
  warning?: string;
}

export class PositionSizer {
  /**
   * 計算開倉的保證金與合約數量。
   * 
   * @param config 回測配置
   * @param currentBalance 當前可用餘額
   * @param currentEquity 當前總權益
   * @param entryPrice 實際成交價格
   * @param slPrice 止損價格
   */
  static calculateSize(
    config: BacktestConfig,
    currentBalance: number,
    currentEquity: number,
    entryPrice: number,
    slPrice: number,
  ): SizingResult {
    let mode: 'FIXED_PERCENT' | 'RISK_BASED' = config.positionSizingMode;
    let warning: string | undefined;

    // 降級容錯機制：如果選擇 RISK_BASED 但未設定 SL 價格（如 SL % 為 0）
    if (mode === 'RISK_BASED' && (!slPrice || slPrice === entryPrice)) {
      mode = 'FIXED_PERCENT';
      warning = 'Selected Risk-based mode but SL is 0 or not configured. Downgraded to Fixed Margin Percent mode.';
    }

    let margin = 0;
    const leverage = config.leverage || 1;

    if (mode === 'FIXED_PERCENT') {
      const fixedMarginPercent = config.fixedMarginPercent ?? 10;
      margin = currentBalance * (fixedMarginPercent / 100);
    } else {
      // RISK_BASED 模式
      const riskPercent = config.riskPercentPerTrade ?? 1;
      const riskAmount = currentEquity * (riskPercent / 100);
      const priceDiff = Math.abs(entryPrice - slPrice);
      
      // Quantity = riskAmount / |entryPrice - slPrice|
      const qty = riskAmount / priceDiff;
      // Margin = qty * entryPrice / leverage
      margin = (qty * entryPrice) / leverage;
    }

    // 邊界規則：單筆開倉保證金不可超過當前可用餘額
    if (margin > currentBalance) {
      margin = currentBalance;
    }

    // 計算合約數量：Quantity = Margin * leverage / entryPrice
    const quantity = (margin * leverage) / entryPrice;

    // 最小下單量檢查 (Binance 永續合約名目價值通常需 >= 5 USDT)
    const nominalValue = quantity * entryPrice;
    if (nominalValue < 5 || isNaN(quantity) || quantity <= 0) {
      return {
        margin: 0,
        quantity: 0,
        modeUsed: mode,
        warning: warning ? `${warning} Order nominal value (${nominalValue.toFixed(2)} USDT) is below 5 USDT limit.` : undefined,
      };
    }

    return {
      margin,
      quantity,
      modeUsed: mode,
      warning,
    };
  }
}
