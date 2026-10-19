import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { OHLCVKline } from './types';

export interface VolumeRanking {
  symbol: string;
  quoteVolume: number;
}

export interface SymbolUniverseCache {
  hot: string[];
  warm: string[];
  pinned: string[];
  activeSymbols: string[];
  activeTimestampMap: Record<string, number>;
  totalTradableCandidates: number;
  updatedAt: number;
}

const ALL_KLINE_INTERVALS = ['5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M'];

@Injectable()
export class MarketCacheService {
  constructor(private readonly redisService: RedisService) {}

  private get client() {
    return this.redisService.getClient();
  }

  // TTL constants (in seconds)
  private readonly PRICE_TTL = 30; // 30s (增加緩衝以防止網路抖動導致 Key 閃爍消失)
  private readonly RANKING_TTL = 3600; // 1h (拉長排行快取過期時間，確保排程重疊與取樣檢驗時不閃爍消失)
  private readonly SCREENER_TTL = 60; // 60s

  private getIntervalTTL(interval: string): number {
    const ttls: Record<string, number> = {
      '5m': 7200, // 2h (拉長快取過期時間，避免因佇列排隊處理延遲導致快取消失)
      '15m': 21600, // 6h
      '30m': 43200, // 12h
      '1h': 86400, // 1d
      '2h': 172800, // 2d
      '4h': 345600, // 4d
      '1d': 604800, // 7d
      '1w': 2592000, // 30d
      '1M': 7776000, // 90d
    };
    return ttls[interval] || 3600;
  }

  /**
   * 寫入單一交易對最新成交價 (採用 Redis Hash market:prices 儲存以減少 Key 數量與寫入負載)
   */
  async setPrice(symbol: string, price: number): Promise<void> {
    const hashKey = 'market:prices';
    await this.client.hset(hashKey, symbol, price.toString());
    await this.client.expire(hashKey, this.PRICE_TTL);
  }

  /**
   * 取得單一交易對最新成交價
   */
  async getPrice(symbol: string): Promise<number | null> {
    const hashKey = 'market:prices';
    const value = await this.client.hget(hashKey, symbol);
    return value ? parseFloat(value) : null;
  }

  /**
   * 批次寫入多個交易對最新成交價 (使用單一 HSET 批次寫入，大幅降減 Redis 呼叫頻率與 CPU 負載)
   */
  async setPricesPipeline(prices: { symbol: string; price: number }[]): Promise<void> {
    if (prices.length === 0) return;
    const hashKey = 'market:prices';
    const data: Record<string, string> = {};
    for (const item of prices) {
      data[item.symbol] = item.price.toString();
    }
    await this.client.hset(hashKey, data);
    await this.client.expire(hashKey, this.PRICE_TTL);
  }

  /**
   * 寫入指定交易對與時間週期之最新 500 根 K 線資料 (採用緊湊陣列序列化以節省 ~68% Redis 記憶體)
   */
  async setKlines(symbol: string, interval: string, prices: OHLCVKline[]): Promise<void> {
    const key = `market:klines:${symbol}:${interval}`;
    const ttl = this.getIntervalTTL(interval);
    // 壓縮為 [openTime, open, high, low, close, volume, closeTime] 緊湊數值陣列
    const compact = prices.map((k) => [
      k.openTime,
      k.open,
      k.high,
      k.low,
      k.close,
      k.volume,
      k.closeTime,
    ]);
    await this.client.setex(key, ttl, JSON.stringify(compact));
  }

  /**
   * 取得指定交易對與時間週期之歷史 K 線資料 (相容緊湊陣列與歷史完整物件格式)
   */
  async getKlines(symbol: string, interval: string): Promise<OHLCVKline[] | null> {
    const key = `market:klines:${symbol}:${interval}`;
    const value = await this.client.get(key);
    if (!value) return null;

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed) || parsed.length === 0) return [];

      // 若儲存為緊湊陣列格式，自動解包還原為 OHLCVKline 物件
      if (Array.isArray(parsed[0])) {
        return parsed.map((k: any) => ({
          openTime: Number(k[0]),
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
          volume: Number(k[5]),
          closeTime: Number(k[6]),
        }));
      }

      // 相容歷史舊格式（純物件陣列）
      return parsed as OHLCVKline[];
    } catch {
      return null;
    }
  }

  /**
   * 刪除已退池標的的所有時間週期 K 線快取，釋放 Redis 記憶體
   */
  async deleteSymbolKlines(symbols: string[]): Promise<void> {
    if (!symbols || symbols.length === 0) return;
    if (typeof (this.client as any).del !== 'function') return;

    const keys: string[] = [];
    for (const symbol of symbols) {
      for (const interval of ALL_KLINE_INTERVALS) {
        keys.push(`market:klines:${symbol}:${interval}`);
      }
    }

    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  /**
   * 寫入 24h 成交量排行
   */
  async setVolumeRanking(ranking: VolumeRanking[]): Promise<void> {
    const key = `market:ranking:volume`;
    await this.client.setex(key, this.RANKING_TTL, JSON.stringify(ranking));
  }

  /**
   * 取得 24h 成交量排行
   */
  async getVolumeRanking(): Promise<VolumeRanking[] | null> {
    const key = `market:ranking:volume`;
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * 寫入當前活躍可交易標的池 (Active Universe)
   */
  async setSymbolUniverse(universe: SymbolUniverseCache): Promise<void> {
    const key = `market:universe`;
    await this.client.setex(key, this.RANKING_TTL, JSON.stringify(universe));
  }

  /**
   * 取得當前活躍可交易標的池 (Active Universe)
   */
  async getSymbolUniverse(): Promise<SymbolUniverseCache | null> {
    const key = `market:universe`;
    try {
      const value = await this.client.get(key);
      if (!value) return null;
      const parsed = JSON.parse(value);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        !Array.isArray(parsed.activeSymbols)
      ) {
        return null;
      }
      return parsed as SymbolUniverseCache;
    } catch {
      return null;
    }
  }

  /**
   * 當使用者將新標的加入自選清單時，即時將其併入 Redis 的 Active Universe 白名單
   */
  async addPinnedSymbolToUniverse(symbol: string): Promise<void> {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;

    const universe = await this.getSymbolUniverse();
    if (!universe) return;

    if (!universe.activeSymbols.includes(normalized)) {
      universe.pinned = Array.from(new Set([...(universe.pinned || []), normalized]));
      universe.activeSymbols = [...universe.activeSymbols, normalized];
      universe.updatedAt = Date.now();
      await this.setSymbolUniverse(universe);
    }
  }

  /**
   * 寫入篩選器結果快取
   */
  async setScreenerResult(strategyHash: string, symbols: string[]): Promise<void> {
    const key = `screener:result:${strategyHash}`;
    await this.client.setex(key, this.SCREENER_TTL, JSON.stringify(symbols));
  }

  /**
   * 取得篩選器結果快取
   */
  async getScreenerResult(strategyHash: string): Promise<string[] | null> {
    const key = `screener:result:${strategyHash}`;
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  /**
   * 批次取得多個交易對最新成交價 (使用 Redis HMGET 從單一 Hash 取得)
   */
  async getPrices(symbols: string[]): Promise<Record<string, number | null>> {
    if (symbols.length === 0) return {};
    const hashKey = 'market:prices';
    const values = await this.client.hmget(hashKey, ...symbols);
    const result: Record<string, number | null> = {};
    symbols.forEach((symbol, index) => {
      const val = values[index];
      result[symbol] = val ? parseFloat(val) : null;
    });
    return result;
  }
}
