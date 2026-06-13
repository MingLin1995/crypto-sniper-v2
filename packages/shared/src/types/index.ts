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
