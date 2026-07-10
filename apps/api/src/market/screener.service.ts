import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { BinanceService } from './binance.service';
import { MarketCacheService } from './market-cache.service';
import { ScreenerRequestDto, ScreenerTimeframeBlockDto, MAConditionDto } from './dto/screener.dto';
import { calculateSMA, calculateEMA, calculateRSI, calculateMACD } from './indicators';
import * as crypto from 'crypto';

@Injectable()
export class ScreenerService {
  private readonly logger = new Logger(ScreenerService.name);

  constructor(
    private readonly binanceService: BinanceService,
    private readonly marketCacheService: MarketCacheService,
  ) {}

  /**
   * 執行多時框均線條件篩選
   */
  async screen(dto: ScreenerRequestDto): Promise<any[]> {
    let matchingSymbols: string[];

    if (!dto.timeframes || dto.timeframes.length === 0) {
      // 預設沒有篩選條件時，撈取所有交易對
      matchingSymbols = await this.binanceService.getUSDTFuturesSymbols();
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
        // 2. 獲取所有永續合約交易對
        const symbols = await this.binanceService.getUSDTFuturesSymbols();
        if (symbols.length === 0) {
          throw new ServiceUnavailableException('目前無法取得交易對資料');
        }

        // 3. 行情預熱偵測：檢索所有配置的時間週期之 K 線快取。
        // 若任何一個時框的快取覆蓋率小於 10% 且至少有 5 個交易對時，判定系統該時框處於行情預熱狀態。
        for (const tf of dto.timeframes) {
          const sampleCheckCount = Math.min(20, symbols.length);
          const sampleSymbols = symbols.slice(0, sampleCheckCount);
          const caches = await Promise.all(
            sampleSymbols.map((s) => this.marketCacheService.getKlines(s, tf.interval)),
          );
          const cachedCount = caches.filter((c) => c && c.length > 0).length;
          
          // 若取樣中快取命中率小於 10%，拋出預熱異常
          if (cachedCount === 0 || cachedCount / sampleCheckCount < 0.1) {
            throw new ServiceUnavailableException(`行情資料 (${tf.interval}) 預熱中，請稍後再試`);
          }
        }

        // 4. 篩選各交易對
        matchingSymbols = await this.runScreening(symbols, dto.timeframes);

        // 5. 寫入快取 (TTL: 60s)
        await this.marketCacheService.setScreenerResult(hash, matchingSymbols);
      }
    }

    // 6. 補齊最新價格與 24h 成交量資訊
    const ranking = (await this.marketCacheService.getVolumeRanking()) || [];
    const volumeMap = new Map<string, number>();
    ranking.forEach((r) => volumeMap.set(r.symbol, r.quoteVolume));

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
   * 對所有交易對進行平行篩選
   */
  private async runScreening(
    // 限制同時執行篩選評估的併發數量，防範 Redis 負載過大與過多 on-the-fly HTTP 請求
    symbols: string[],
    timeframes: ScreenerTimeframeBlockDto[],
  ): Promise<string[]> {
    const matchingSymbols: string[] = [];

    const concurrencyLimit = 20;
    const chunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += concurrencyLimit) {
      chunks.push(symbols.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (symbol) => {
          const isMatch = await this.checkSymbolMatches(symbol, timeframes);
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
  ): Promise<boolean> {
    for (const tf of timeframes) {
      const prices = await this.getKlinesWithFallback(symbol, tf.interval);
      if (!prices || prices.length === 0) {
        return false; // 無法取得歷史行情時不符合
      }

      for (const cond of tf.conditions) {
        if (!this.evaluateCondition(prices, cond)) {
          return false; // 有任一條件不符時，即不符合
        }
      }
    }
    return true; // 通過所有時框條件
  }

  /**
   * 取得收盤價陣列，若快取未命中則實時調用幣安 API 並回寫快取
   */
  private async getKlinesWithFallback(symbol: string, interval: string): Promise<number[]> {
    const cached = await this.marketCacheService.getKlines(symbol, interval);
    if (cached && cached.length > 0) {
      return cached;
    }

    try {
      this.logger.warn(`K-line cache miss for ${symbol} (${interval}), fetching on-the-fly...`);
      const klines = await this.binanceService.getKlines(symbol, interval);
      await this.marketCacheService.setKlines(symbol, interval, klines);
      return klines;
    } catch (err: any) {
      this.logger.error(
        `Failed to fetch klines on-the-fly for ${symbol} (${interval}): ${err.message}`,
      );
      return [];
    }
  }

  private normalizeCondition(cond: MAConditionDto) {
    if (cond.ma1Type && cond.ma1Period !== undefined && cond.ma2Type && cond.ma2Period !== undefined) {
      return {
        type: cond.ma1Type,
        period: cond.ma1Period,
        operator: cond.operator,
        compareType: 'indicator' as const,
        compareIndicatorType: cond.ma2Type,
        comparePeriod: cond.ma2Period,
      };
    }
    return {
      type: cond.type || 'EMA',
      period: cond.period,
      macdFast: cond.macdFast,
      macdSlow: cond.macdSlow,
      macdSignal: cond.macdSignal,
      macdProperty: cond.macdProperty,
      operator: cond.operator,
      compareType: cond.compareType || 'indicator',
      compareIndicatorType: cond.compareIndicatorType,
      comparePeriod: cond.comparePeriod,
      compareMacdFast: cond.compareMacdFast,
      compareMacdSlow: cond.compareMacdSlow,
      compareMacdSignal: cond.compareMacdSignal,
      compareMacdProperty: cond.compareMacdProperty,
      compareValue: cond.compareValue,
    };
  }

  private getIndicatorSeries(
    prices: number[],
    type: 'SMA' | 'EMA' | 'RSI' | 'MACD',
    params: {
      period?: number;
      macdFast?: number;
      macdSlow?: number;
      macdSignal?: number;
      macdProperty?: 'macd' | 'signal' | 'hist';
    },
  ): (number | null)[] {
    switch (type) {
      case 'SMA':
        return calculateSMA(prices, params.period || 14);
      case 'EMA':
        return calculateEMA(prices, params.period || 14);
      case 'RSI':
        return calculateRSI(prices, params.period || 14);
      case 'MACD': {
        const fast = params.macdFast || 12;
        const slow = params.macdSlow || 26;
        const sig = params.macdSignal || 9;
        const macdRes = calculateMACD(prices, fast, slow, sig);
        if (params.macdProperty === 'signal') return macdRes.signal;
        if (params.macdProperty === 'hist') return macdRes.histogram;
        return macdRes.macd;
      }
      default:
        return Array(prices.length).fill(null);
    }
  }

  /**
   * 評估單一指標條件是否成立
   */
  private evaluateCondition(prices: number[], cond: MAConditionDto): boolean {
    const norm = this.normalizeCondition(cond);

    const series1 = this.getIndicatorSeries(prices, norm.type as any, {
      period: norm.period,
      macdFast: norm.macdFast,
      macdSlow: norm.macdSlow,
      macdSignal: norm.macdSignal,
      macdProperty: norm.macdProperty,
    });
    const val1 = series1[series1.length - 1];

    if (val1 === null || val1 === undefined || isNaN(val1)) {
      return false;
    }

    let val2: number | null = null;
    if (norm.compareType === 'value') {
      val2 = norm.compareValue !== undefined ? norm.compareValue : null;
    } else {
      const series2 = this.getIndicatorSeries(prices, (norm.compareIndicatorType || 'EMA') as any, {
        period: norm.comparePeriod,
        macdFast: norm.compareMacdFast,
        macdSlow: norm.compareMacdSlow,
        macdSignal: norm.compareMacdSignal,
        macdProperty: norm.compareMacdProperty,
      });
      val2 = series2[series2.length - 1];
    }

    if (val2 === null || val2 === undefined || isNaN(val2)) {
      return false;
    }

    if (norm.operator === 'gt') {
      return val1 > val2;
    } else if (norm.operator === 'lt') {
      return val1 < val2;
    }

    return false;
  }

  /**
   * 將篩選配置結構化排序後雜湊，生成唯一的快取 Key
   */
  private hashConfig(dto: ScreenerRequestDto): string {
    const normalized = dto.timeframes.map((tf) => ({
      interval: tf.interval,
      conditions: tf.conditions.map((c) => this.normalizeCondition(c))
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    })).sort((a, b) => a.interval.localeCompare(b.interval));

    const jsonStr = JSON.stringify(normalized);
    return crypto.createHash('sha256').update(jsonStr).digest('hex');
  }
}
