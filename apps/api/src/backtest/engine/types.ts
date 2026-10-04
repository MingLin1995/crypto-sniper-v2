
import { MAConditionDto } from '../../market/dto/screener.dto';

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  entryTime: number;
  margin: number; // 占用保證金
  leverage: number;
  quantity: number; // 合約數量
  slPrice: number;
  tpPrice: number;
  unrealizedPnL: number;
  holdingCandles?: number; // 持有 K 棒計數
}

export interface CompletedTrade {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnl: number; // 含手續費、funding、滑價
  pnlPercent: number;
  reason: 'TP' | 'SL' | 'LIQUIDATION' | 'SIGNAL_EXIT' | string;
}

export interface PerformanceStats {
  roi: number; // 總收益率 (最終權益 / 初始資金 - 1)
  annualizedRoi: number; // 年化收益率
  winRate: number; // 勝率
  profitFactor: number; // 盈虧比
  maxDrawdown: number; // 最大回撤 MDD
  sharpeRatio: number; // 夏普比率
  calmarRatio: number; // Calmar Ratio
  totalTrades: number; // 總交易筆數
  avgHoldDuration: number; // 平均持倉時間 (毫秒)
  maxConsecutiveLosses: number; // 最大連續虧損筆數
  maxConsecutiveWins: number; // 最大連續盈利筆數
  maxDrawdownDuration: number; // 最大資金曲線回撤持續時間 (K 棒數)
  buyHoldRoi?: number; // 單純買進持有報酬率 (%)
  monthlyDcaRoi?: number; // 每月定期定額報酬率 (%)
  btcBuyHoldRoi?: number; // BTC 基準單純買進持有報酬率 (%)
  btcMonthlyDcaRoi?: number; // BTC 基準每月定期定額報酬率 (%)
}

export interface BacktestState {
  initialBalance: number;
  currentBalance: number; // 可用餘額
  equity: number; // 總權益 (balance + unrealized)
  positions: Position[];
  trades: CompletedTrade[];
  equityCurve: { timestamp: number; equity: number }[];
  stats: PerformanceStats;
}

export interface BacktestConfig {
  strategyId?: string;
  strategyName?: string;
  symbols: string[];
  interval: string;
  startTime: number;
  endTime: number;
  leverage: number;
  takerFeeRate: number;
  makerFeeRate: number;
  slippage: number;
  // --- Core Simple Risk & Exit Rules ---
  slPercent?: number; // 固定停損 % (例如 5 代表 5%)
  tpPercent?: number; // 固定停利 % (例如 15 代表 15%)
  useSignalExit?: boolean; // 訊號反向平倉 (預設 true，例如均線死叉時平倉)
  exitConditionMode?: 'AUTO_REVERSE' | 'CUSTOM' | 'NONE'; // 平倉模式：自動反向、自訂條件、無
  exitConditions?: MAConditionDto[]; // 自訂平倉指標條件

  initialBalance: number;
  fundingRate: number; // e.g. 0.0001 (0.01% per 8 hours)
  positionSizingMode: 'FIXED_PERCENT' | 'RISK_BASED';
  fixedMarginPercent?: number; // e.g. 10
  riskPercentPerTrade?: number; // e.g. 1
  maxPositions?: number; // default 5
  timeframes: {
    interval: string;
    conditions: MAConditionDto[];
  }[];
}


