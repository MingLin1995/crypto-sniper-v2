import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface TickerPrice {
  symbol: string;
  price: number;
}

export interface VolumeRanking {
  symbol: string;
  quoteVolume: number;
}

@Injectable()
export class BinanceService {
  private readonly logger = new Logger(BinanceService.name);
  private readonly baseUrl = 'https://fapi.binance.com';

  /**
   * 拉取所有可用 USDT 合約交易對清單 (永續合約)
   */
  async getUSDTFuturesSymbols(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/fapi/v1/exchangeInfo`);
      const symbols = response.data.symbols || [];
      return symbols
        .filter(
          (s: any) =>
            s.quoteAsset === 'USDT' &&
            s.status === 'TRADING' &&
            s.contractType === 'PERPETUAL',
        )
        .map((s: any) => s.symbol);
    } catch (error: any) {
      this.logger.error('Failed to fetch USDT futures symbols from Binance', error?.stack);
      throw error;
    }
  }

  /**
   * 拉取指定交易對之歷史 K 線（最新 240 根收盤價，支援 9 個時間週期）
   */
  async getKlines(symbol: string, interval: string, limit = 240): Promise<number[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/fapi/v1/klines`, {
        params: {
          symbol,
          interval,
          limit,
        },
      });
      const klines = response.data || [];
      return klines.map((k: any[]) => parseFloat(k[4]));
    } catch (error: any) {
      this.logger.error(
        `Failed to fetch klines for ${symbol} with interval ${interval} from Binance`,
        error?.stack,
      );
      throw error;
    }
  }

  /**
   * 拉取全市場最新成交價（批次 API，僅過濾 USDT 交易對）
   */
  async getTickerPrices(): Promise<TickerPrice[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/fapi/v1/ticker/price`);
      const tickers = response.data || [];
      return tickers
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .map((t: any) => ({
          symbol: t.symbol,
          price: parseFloat(t.price),
        }));
    } catch (error: any) {
      this.logger.error('Failed to fetch ticker prices from Binance', error?.stack);
      throw error;
    }
  }

  /**
   * 拉取 24h 成交量排行（僅過濾 USDT 交易對，供熱度分流使用）
   */
  async get24hVolumeRanking(): Promise<VolumeRanking[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/fapi/v1/ticker/24hr`);
      const tickers = response.data || [];
      
      return (tickers as any[])
        .filter((t) => t.symbol.endsWith('USDT'))
        .map((t) => ({
          symbol: t.symbol,
          quoteVolume: parseFloat(t.quoteVolume),
        }))
        .filter((t) => !isNaN(t.quoteVolume))
        .sort((a, b) => b.quoteVolume - a.quoteVolume);
    } catch (error: any) {
      this.logger.error('Failed to fetch 24h volume ranking from Binance', error?.stack);
      throw error;
    }
  }
}
