import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';

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
  private readonly axiosInstance: AxiosInstance;
  private lastUsedWeight = 0;
  private cachedSymbols: string[] = [];
  private cacheTimestamp = 0;
  private readonly CACHE_TTL = 3600 * 1000; // 1 小時記憶體快取

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 5000, // 5秒超時保護，避免請求掛起阻塞排程
      httpsAgent: new https.Agent({
        keepAlive: true, // 啟用 Keep-Alive 複用 Socket 連線，大幅降低 TLS/TCP 握手延遲
        maxSockets: 50, // 最大連線池大小
      }),
    });

    this.axiosInstance.interceptors.response.use(
      (response) => {
        const weightHeader =
          response.headers['x-mbx-used-weight-1m'] || response.headers['X-MBX-USED-WEIGHT-1M'];
        if (weightHeader) {
          this.lastUsedWeight = parseInt(weightHeader as string, 10);
        }
        return response;
      },
      (error) => {
        if (error.response) {
          const weightHeader =
            error.response.headers['x-mbx-used-weight-1m'] ||
            error.response.headers['X-MBX-USED-WEIGHT-1M'];
          if (weightHeader) {
            this.lastUsedWeight = parseInt(weightHeader as string, 10);
          }
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * 獲取最近一次請求回傳的 API 權重 (1分鐘累計值)
   */
  getUsedWeight(): number {
    return this.lastUsedWeight;
  }

  /**
   * 批次與降級機制：拉取所有可用 USDT 合約交易對清單 (永續合約) - 具備 1 小時記憶體快取
   */
  async getUSDTFuturesSymbols(): Promise<string[]> {
    const now = Date.now();
    if (this.cachedSymbols.length > 0 && now - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cachedSymbols;
    }

    try {
      const response = await this.axiosInstance.get('/fapi/v1/exchangeInfo');
      const symbols = response.data.symbols || [];
      const filteredSymbols = symbols
        .filter(
          (s: any) =>
            s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.contractType === 'PERPETUAL',
        )
        .map((s: any) => s.symbol);

      if (filteredSymbols.length > 0) {
        this.cachedSymbols = filteredSymbols;
        this.cacheTimestamp = now;
      }
      return filteredSymbols;
    } catch (error: any) {
      // 降級：若 API 呼叫失敗但記憶體已有快取，降級回傳舊快取以防止業務中斷
      if (this.cachedSymbols.length > 0) {
        this.logger.warn('Failed to fetch new USDT symbols from Binance, falling back to cached list');
        return this.cachedSymbols;
      }
      this.logger.error('Failed to fetch USDT futures symbols from Binance', error?.stack);
      throw error;
    }
  }

  /**
   * 拉取指定交易對之歷史 K 線（最新 240 根收盤價，支援 9 個時間週期）
   */
  async getKlines(symbol: string, interval: string, limit = 240): Promise<number[]> {
    try {
      const response = await this.axiosInstance.get('/fapi/v1/klines', {
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
      const response = await this.axiosInstance.get('/fapi/v1/ticker/price');
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
      const response = await this.axiosInstance.get('/fapi/v1/ticker/24hr');
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
