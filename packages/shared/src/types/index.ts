export interface UserDto {
  id: string;
  email: string;
  role: string;
}

export type AlertCondition = 'above' | 'below';

export interface WatchlistItemDto {
  symbol: string;
}

export interface CreatePriceAlertDto {
  symbol: string;
  targetPrice: number;
  condition: AlertCondition;
  notificationMethod: string[];
}

export interface MACondition {
  ma1Type: 'SMA' | 'EMA';
  ma1Period: number;
  operator: 'gt' | 'lt';
  ma2Type: 'SMA' | 'EMA';
  ma2Period: number;
}

export interface ScreenerTimeframeBlock {
  interval: string;
  conditions: MACondition[];
}

export interface ScreenerRequestDto {
  timeframes: ScreenerTimeframeBlock[];
  category?: string;
  sortOrder?: number;
  categories?: string[];
}

export interface SavedStrategyDto {
  id: string;
  name: string;
  config: ScreenerRequestDto;
  createdAt: string;
  updatedAt: string;
}

