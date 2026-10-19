import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { BinanceService, VolumeRanking } from './binance.service';
import { MarketCacheService } from './market-cache.service';
import { ScreenerRequestDto, ScreenerTimeframeBlockDto } from './dto/screener.dto';
import { evaluateCondition, normalizeCondition } from './helpers/indicator-evaluator';
import { classifySymbolUniverse, getUniverseConfigFromEnv } from './helpers/symbol-universe';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { OHLCVKline } from './types';
import * as crypto from 'crypto';

/** 單次篩選請求允許的最大即時 (on-the-fly) API 補拉次數，防止啟動初期或首頁預覽觸發全量併發爬蟲 */
const MAX_ON_THE_FLY_FETCHES_PER_SCREEN = 10;

@Injectable()
export class ScreenerService {
  private readonly logger = new Logger(ScreenerService.name);

  constructor(
    private readonly binanceService: BinanceService,
    private readonly marketCacheService: MarketCacheService,
    @Optional() private readonly prisma?: ExtendedPrismaService,
  ) {}

  /**
   * 取得當前活躍可交易標的池 (Active Universe = Hot 50 ∪ Top 18%~25% Warm ∪ Watchlist Pinned)
   * 優先讀取 Redis 快取的 market:universe，若無則即時依 24h 成交量排行與自選清單計算
   */
  private async getActiveUniverseSymbols(cachedRanking?: VolumeRanking[]): Promise<string[]> {
    const cachedUniverse = await this.marketCacheService.getSymbolUniverse?.();
    if (cachedUniverse?.activeSymbols && cachedUniverse.activeSymbols.length > 0) {
      return cachedUniverse.activeSymbols;
    }

    const validSymbols = await this.binanceService.getUSDTFuturesSymbols();
    if (!validSymbols || validSymbols.length === 0) {
      return [];
    }

    const ranking = cachedRanking ?? (await this.marketCacheService.getVolumeRanking()) ?? [];
    let pinnedSymbols: string[] = [];
    if (this.prisma?.client?.watchlistItem?.findMany) {
      try {
        const items = await this.prisma.client.watchlistItem.findMany({
          select: { symbol: true },
          distinct: ['symbol'],
        });
        pinnedSymbols = items.map((i: { symbol: string }) => i.symbol);
      } catch {
        pinnedSymbols = [];
      }
    }

    const universe = classifySymbolUniverse({
      validSymbols,
      ranking,
      pinnedSymbols,
      config: getUniverseConfigFromEnv(),
    });

    return universe.activeSymbols;
  }

  /**
   * 執行多時框均線條件篩選
   */
  async screen(dto: ScreenerRequestDto): Promise<any[]> {
    let matchingSymbols: string[];
    const currentRanking = (await this.marketCacheService.getVolumeRanking()) || [];

    if (!dto.timeframes || dto.timeframes.length === 0) {
      // 預設沒有篩選條件時，僅回傳高流動性池與自選清單 (Active Universe)
      matchingSymbols = await this.getActiveUniverseSymbols(currentRanking);
      if (!matchingSymbols || matchingSymbols.length === 0) {
        return [];
      }
    } else {
      // 1. 生成配置的 Hash 作為 Redis 快取 Key
      const hash = this.hashConfig(dto);
      const cachedSymbols = await this.marketCacheService.getScreenerResult(hash);

      if (cachedSymbols) {
        matchingSymbols = cachedSymbols;
      } else {
        // 2. 獲取活躍可交易標的池 (Active Universe)，不再全掃 700+ 長尾合約
        const symbols = await this.getActiveUniverseSymbols(currentRanking);
        if (symbols.length === 0) {
          throw new ServiceUnavailableException('目前無法取得交易對資料');
        }

        // 3. 行情預熱偵測：優先採樣 24h 交易量排行前列的熱門標的進行快取檢驗。
        // 若排行快取暫時為空，優先以主流標的為錨點候選清單，避免因字首字母排序（如 1000xxx 開頭冷門幣種）誤判系統預熱中。
        const fallbackAnchors = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
        const activeSet = new Set(symbols);
        const rankedActive = currentRanking
          .map((r) => r.symbol)
          .filter((s) => activeSet.has(s));
        const candidateSymbols =
          rankedActive.length > 0
            ? rankedActive
            : [
                ...symbols.filter((s) => fallbackAnchors.includes(s)),
                ...symbols.filter((s) => !fallbackAnchors.includes(s)),
              ];

        for (const tf of dto.timeframes) {
          const sampleCheckCount = Math.min(20, candidateSymbols.length);
          const sampleSymbols = candidateSymbols.slice(0, sampleCheckCount);
          const caches = await Promise.all(
            sampleSymbols.map((s) => this.marketCacheService.getKlines(s, tf.interval)),
          );
          let cachedCount = caches.filter((c) => c && c.length > 0).length;

          // 若採樣標的之快取全部皆缺失，嘗試即時為前 3 檔核心標的拉取補齊
          if (cachedCount === 0) {
            const bootstrapCount = Math.min(3, sampleSymbols.length);
            const bootstrapped = await Promise.all(
              sampleSymbols.slice(0, bootstrapCount).map(async (s) => {
                const klines = await this.getKlinesWithFallback(s, tf.interval);
                return klines && klines.length > 0;
              }),
            );
            cachedCount = bootstrapped.filter(Boolean).length;
          }

          // 若連即時拉取皆完全無資料 (如幣安 API 斷線或未就緒)，才拋出預熱異常
          if (cachedCount === 0) {
            throw new ServiceUnavailableException(`行情資料 (${tf.interval}) 預熱中，請稍後再試`);
          }
        }

        // 4. 篩選活躍池內各交易對
        matchingSymbols = await this.runScreening(symbols, dto.timeframes);

        // 5. 寫入快取 (TTL: 60s)
        await this.marketCacheService.setScreenerResult(hash, matchingSymbols);
      }
    }

    // 6. 補齊最新價格與 24h 成交量資訊
    const volumeMap = new Map<string, number>();
    currentRanking.forEach((r) => volumeMap.set(r.symbol, r.quoteVolume));

    const priceMap = await this.marketCacheService.getPrices(matchingSymbols);

    const results = matchingSymbols.map((symbol) => ({
      symbol,
      price: priceMap[symbol] || 0,
      volume: volumeMap.get(symbol) || 0,
    }));

    // 依成交量降冪排序
    return results.sort((a, b) => b.volume - a.volume);
  }

  /**
   * 對活躍池交易對進行平行篩選
   */
  private async runScreening(
    // 限制同時執行篩選評估的併發數量，防範 Redis 負載過大與過多 on-the-fly HTTP 請求
    symbols: string[],
    timeframes: ScreenerTimeframeBlockDto[],
  ): Promise<string[]> {
    const matchingSymbols: string[] = [];
    const onTheFlyBudget = { remaining: MAX_ON_THE_FLY_FETCHES_PER_SCREEN };

    const concurrencyLimit = 20;
    const chunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += concurrencyLimit) {
      chunks.push(symbols.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (symbol) => {
          const isMatch = await this.checkSymbolMatches(symbol, timeframes, onTheFlyBudget);
          return { symbol, isMatch };
        }),
      );

      results.forEach((r) => {
        if (r.isMatch) {
          matchingSymbols.push(r.symbol);
        }
      });
    }

    return matchingSymbols;
  }

  /**
   * 檢查單一標的是否符合所有時框的全部條件
   */
  private async checkSymbolMatches(
    symbol: string,
    timeframes: ScreenerTimeframeBlockDto[],
    onTheFlyBudget?: { remaining: number },
  ): Promise<boolean> {
    for (const tf of timeframes) {
      const prices = await this.getKlinesWithFallback(symbol, tf.interval, onTheFlyBudget);
      if (!prices || prices.length === 0) {
        return false; // 無法取得歷史行情時不符合
      }

      for (const cond of tf.conditions) {
        if (!evaluateCondition(prices, cond)) {
          return false; // 有任一條件不符時，即不符合
        }
      }
    }
    return true; // 通過所有時框條件
  }

  /**
   * 取得 K 線資料，若快取未命中且仍在安全配額內，則實時調用幣安 API 並回寫快取
   */
  private async getKlinesWithFallback(
    symbol: string,
    interval: string,
    onTheFlyBudget?: { remaining: number },
  ): Promise<OHLCVKline[]> {
    const cached = await this.marketCacheService.getKlines(symbol, interval);
    if (cached && cached.length > 0) {
      return cached;
    }

    // 防護機制：若已達單次篩選即時補拉上限，或幣安 API 權重過高 (>1800)，則直接略過不觸發 API 風暴
    const usedWeight = this.binanceService.getUsedWeight?.() ?? 0;
    if (usedWeight > 1800) {
      return [];
    }
    if (onTheFlyBudget) {
      if (onTheFlyBudget.remaining <= 0) {
        return [];
      }
      onTheFlyBudget.remaining -= 1;
    }

    try {
      this.logger.warn(`K-line cache miss for ${symbol} (${interval}), fetching on-the-fly...`);
      const klines = await this.binanceService.getKlines(symbol, interval);
      if (klines && klines.length > 0) {
        await this.marketCacheService.setKlines(symbol, interval, klines);
      }
      return klines || [];
    } catch (err: any) {
      this.logger.error(
        `Failed to fetch klines on-the-fly for ${symbol} (${interval}): ${err.message}`,
      );
      return [];
    }
  }

  /**
   * 將篩選配置結構化排序後雜湊，生成唯一的快取 Key
   */
  private hashConfig(dto: ScreenerRequestDto): string {
    const normalized = dto.timeframes
      .map((tf) => ({
        interval: tf.interval,
        conditions: tf.conditions
          .map((c) => normalizeCondition(c))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      }))
      .sort((a, b) => a.interval.localeCompare(b.interval));

    const jsonStr = JSON.stringify(normalized);
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  }
}
