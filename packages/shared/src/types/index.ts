export interface UserDto {
  id: string;
  email: string;
  role: string;
}

export type AlertCondition = 'above' | 'below';

export interface WatchlistItemDto {
  symbol: string;
}

export interface WatchlistItemPriceDto {
  id: string;
  symbol: string;
  price: number | null;
  createdAt: string;
}

export interface CreatePriceAlertDto {
  symbol: string;
  targetPrice: number;
  condition: AlertCondition;
  notificationMethod: string[];
}

export interface MACondition {
  type?: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'PRICE';
  period?: number | '';
  macdFast?: number | '';
  macdSlow?: number | '';
  macdSignal?: number | '';
  macdProperty?: 'macd' | 'signal' | 'hist';

  operator: 'gt' | 'lt';

  compareType?: 'indicator' | 'value';
  compareIndicatorType?: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'PRICE';
  comparePeriod?: number | '';
  compareMacdFast?: number | '';
  compareMacdSlow?: number | '';
  compareMacdSignal?: number | '';
  compareMacdProperty?: 'macd' | 'signal' | 'hist';
  compareValue?: number | '';

  ma1Type?: 'SMA' | 'EMA';
  ma1Period?: number | '';
  ma2Type?: 'SMA' | 'EMA';
  ma2Period?: number | '';
}

export interface ScreenerTimeframeBlock {
  interval: string;
  conditions: MACondition[];
}

export interface ScreenerRequestDto {
  timeframes: ScreenerTimeframeBlock[];
}

export interface StrategyConfigDto extends ScreenerRequestDto {
  category?: string;
  sortOrder?: number;
  categories?: string[];
}

export interface SavedStrategyDto {
  id: string;
  name: string;
  config: StrategyConfigDto;
  createdAt: string;
  updatedAt?: string;
}
