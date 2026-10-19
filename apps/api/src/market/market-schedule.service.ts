import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BinanceService, VolumeRanking } from './binance.service';
import { MarketCacheService } from './market-cache.service';
import { BinanceWebsocketService } from './binance-websocket.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import {
  classifySymbolUniverse,
  getUniverseConfigFromEnv,
  SymbolUniverseResult,
} from './helpers/symbol-universe';

interface Task {
  symbol: string;
  interval: string;
}

const INTERVAL_PRIORITY: Record<string, number> = {
  '5m': 1,
  '15m': 2,
  '30m': 3,
  '1h': 4,
  '2h': 5,
  '4h': 6,
  '1d': 7,
  '1w': 8,
  '1M': 9,
};

@Injectable()
export class MarketScheduleService implements OnModuleInit {
  private readonly logger = new Logger(MarketScheduleService.name);
  private queue: Task[] = [];
  private isProcessing = false;
  private symbolRankMap = new Map<string, number>();
  private activeTimestampMap: Record<string, number> = {};

  constructor(
    private readonly binanceService: BinanceService,
    private readonly marketCacheService: MarketCacheService,
    private readonly binanceWebsocketService: BinanceWebsocketService,
    @Optional() private readonly prisma?: ExtendedPrismaService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Market Schedule Service...');
    try {
      // 啟動時預先載入成交量排行與最新價格列表，以確保系統啟動後即有行情基礎資料
      const ranking = await this.updatePricesAndRanking();
      const symbols = await this.binanceService.getUSDTFuturesSymbols();

      // 啟動時預熱常用核心時框的活躍標的池 (優先排序確保 Hot 50 排在佇列最前端優先完成，隨後平滑預熱 Warm + Pinned)
      if (ranking.length > 0 && symbols.length > 0) {
        this.logger.log('Warming up K-line caches on startup (Hot 50 prioritized + Active Universe)...');
        const warmupIntervals = ['15m', '1h', '4h', '1d', '5m'];
        for (const interval of warmupIntervals) {
          // 5m 啟動時僅預熱 Hot 50，其餘核心時框 (15m, 1h, 4h, 1d) 納入完整 Active Universe (由 queue.sort 確保 Hot 50 絕對優先)
          const hotOnly = interval === '5m';
          await this.enqueueKlinesForInterval(interval, false, symbols, ranking, hotOnly);
        }
        // 統一在全部任務皆已入列並排好順序後，才一次性啟動處理器，確保完全遵守優先權排序
        this.processQueue();
      }
    } catch (err: any) {
      this.logger.error('Failed to run initial startup initialization', err?.stack);
    }
  }

  /**
   * 讀取資料庫中所有使用者的自選清單標的 (不重複 symbol)，作為 Pinned 白名單
   */
  private async getPinnedWatchlistSymbols(): Promise<string[]> {
    if (!this.prisma?.client?.watchlistItem?.findMany) {
      return [];
    }
    try {
      const items = await this.prisma.client.watchlistItem.findMany({
        select: { symbol: true },
        distinct: ['symbol'],
      });
      return items.map((item: { symbol: string }) => item.symbol);
    } catch (err: any) {
      this.logger.warn(`Failed to query pinned watchlist symbols: ${err?.message}`);
      return [];
    }
  }

  /**
   * 重新計算活躍可交易標的池 (Active Universe)，同步寫入 Redis 並清理已退池標的的 K 線快取
   */
  async refreshSymbolUniverse(
    cachedSymbols?: string[],
    cachedRanking?: VolumeRanking[],
  ): Promise<SymbolUniverseResult> {
    const validSymbols = cachedSymbols || (await this.binanceService.getUSDTFuturesSymbols());
    const ranking = cachedRanking || (await this.marketCacheService.getVolumeRanking()) || [];
    const pinnedSymbols = await this.getPinnedWatchlistSymbols();

    let previousActiveMap = this.activeTimestampMap;
    if (Object.keys(previousActiveMap).length === 0) {
      const cachedUniverse = await this.marketCacheService.getSymbolUniverse?.();
      if (cachedUniverse?.activeTimestampMap) {
        previousActiveMap = cachedUniverse.activeTimestampMap;
      }
    }

    const universe = classifySymbolUniverse({
      validSymbols,
      ranking,
      pinnedSymbols,
      previousActiveMap,
      config: getUniverseConfigFromEnv(),
    });

    this.activeTimestampMap = universe.activeTimestampMap;

    await this.marketCacheService.setSymbolUniverse?.({
      hot: universe.hot,
      warm: universe.warm,
      pinned: universe.pinned,
      activeSymbols: universe.activeSymbols,
      activeTimestampMap: universe.activeTimestampMap,
      totalTradableCandidates: universe.totalTradableCandidates,
      updatedAt: Date.now(),
    });

    if (universe.dropped.length > 0) {
      this.logger.log(
        `Removing ${universe.dropped.length} dropped symbols from K-line cache: ${universe.dropped.join(', ')}`,
      );
      await this.marketCacheService.deleteSymbolKlines?.(universe.dropped);
    }

    return universe;
  }

  /**
   * 每一小時、每天等大週期，或是初始啟動時，更新並寫入最新的成交量排行與所有價格
   */
  async updatePricesAndRanking(): Promise<VolumeRanking[]> {
    const ranking = await this.binanceService.get24hVolumeRanking();
    await this.marketCacheService.setVolumeRanking(ranking);

    // 更新記憶體中的交易量排行索引，供佇列排序優先權使用 (成交量大 index 小)
    this.symbolRankMap.clear();
    ranking.forEach((r, idx) => {
      this.symbolRankMap.set(r.symbol, idx);
    });

    const tickers = await this.binanceService.getTickerPrices();
    if (tickers.length > 0) {
      await this.marketCacheService.setPricesPipeline(tickers);
    }

    // 同步重算 Active Universe (前 18% 進 / 25% 出 + 6h 寬限期 + Watchlist Pinned)
    try {
      await this.refreshSymbolUniverse(undefined, ranking);
    } catch (err: any) {
      this.logger.warn(`Failed to refresh symbol universe during ranking update: ${err?.message}`);
    }

    return ranking;
  }

  /**
   * 排程：每 10 秒批次拉取全市場最新成交價。
   * 作為 WebSocket 的備援機制 (僅在 WebSocket 斷線或假死時執行以節省 AWS 資源與 API 權重)
   */
  @Cron('*/10 * * * * *')
  async handleTickerPricesUpdate() {
    // 若 WebSocket 正常連線並有行情流量，跳過此 REST 行情更新以節省資源
    if (this.binanceWebsocketService && this.binanceWebsocketService.isAlive()) {
      return;
    }

    try {
      this.logger.log('WebSocket is inactive/dead. Fetching backup ticker prices via REST API...');
      const tickers = await this.binanceService.getTickerPrices();
      if (tickers.length > 0) {
        await this.marketCacheService.setPricesPipeline(tickers);
      }
    } catch (err: any) {
      this.logger.error('Failed to update ticker prices in 10s backup cron job', err?.stack);
    }
  }

  /**
   * 排程：每 5 分鐘拉取全市場 24h 成交量排行與批次價格，同步寫入 Redis (TTL: 5m)
   */
  @Cron('0 */5 * * * *')
  async handleVolumeRankingUpdate() {
    try {
      await this.updatePricesAndRanking();
    } catch (err: any) {
      this.logger.error('Failed to update volume ranking in 5m cron job', err?.stack);
    }
  }

  /**
   * 排程：每 5 分鐘觸發 5m K線更新
   */
  @Cron('0 */5 * * * *')
  async handle5mKlines() {
    await this.enqueueKlinesForInterval('5m');
  }

  /**
   * 排程：每 15 分鐘觸發 15m K線更新
   */
  @Cron('0 */15 * * * *')
  async handle15mKlines() {
    await this.enqueueKlinesForInterval('15m');
  }

  /**
   * 排程：每 30 分鐘觸發 30m K線更新
   */
  @Cron('0 */30 * * * *')
  async handle30mKlines() {
    await this.enqueueKlinesForInterval('30m');
  }

  /**
   * 排程：每 1 小時觸發 1h K線更新
   */
  @Cron('0 0 * * * *')
  async handle1hKlines() {
    await this.enqueueKlinesForInterval('1h');
  }

  /**
   * 排程：每 2 小時觸發 2h K線更新
   */
  @Cron('0 0 */2 * * *')
  async handle2hKlines() {
    await this.enqueueKlinesForInterval('2h');
  }

  /**
   * 排程：每 4 小時觸發 4h K線更新
   */
  @Cron('0 0 */4 * * *')
  async handle4hKlines() {
    await this.enqueueKlinesForInterval('4h');
  }

  /**
   * 排程：每天觸發 1d K線更新
   */
  @Cron('0 0 0 * * *')
  async handle1dKlines() {
    await this.enqueueKlinesForInterval('1d');
  }

  /**
   * 排程：每週觸發 1w K線更新
   */
  @Cron('0 0 0 * * 0')
  async handle1wKlines() {
    await this.enqueueKlinesForInterval('1w');
  }

  /**
   * 排程：每月觸發 1M K線更新
   */
  @Cron('0 0 0 1 * *')
  async handle1MKlines() {
    await this.enqueueKlinesForInterval('1M');
  }

  /**
   * 依時間週期將 Active Universe (Hot + Warm + Pinned) 交易對加入佇列，排除長尾低流動性標的
   */
  private async enqueueKlinesForInterval(
    interval: string,
    startProcessor = true,
    cachedSymbols?: string[],
    cachedRanking?: VolumeRanking[],
    hotOnly = false,
  ) {
    try {
      const symbols = cachedSymbols || (await this.binanceService.getUSDTFuturesSymbols());
      if (symbols.length === 0) return;

      let ranking = cachedRanking || (await this.marketCacheService.getVolumeRanking());
      if (!ranking) {
        ranking = await this.updatePricesAndRanking();
      } else {
        // 確保記憶體中的 symbolRankMap 與最新快取的排行同步，避免重啟或排程競態時 Map 為空
        this.symbolRankMap.clear();
        ranking.forEach((r, idx) => {
          this.symbolRankMap.set(r.symbol, idx);
        });
      }

      // 透過 SymbolUniverse 分層：排除長尾低流動性標的，僅保留 Hot (前 50)、Warm (前 18% 進 / 25% 出 + 6h 寬限) 與 Pinned (自選清單)
      const universe = await this.refreshSymbolUniverse(symbols, ranking);
      const hotSymbols = universe.hot;
      const warmSymbols = [...universe.warm, ...universe.pinned];

      let targetSymbols: string[] = [];

      // 由於 Active Universe 已收斂至約 100~140 檔，核心時框 (15m, 1h, 4h, 1d) 每輪皆完整更新以根除舊 K 線問題；
      // 僅最高頻的 5m 與次要時框 (30m, 2h, 1w, 1M) 對 Warm + Pinned 進行 % 2 奇偶分流
      if (hotOnly) {
        targetSymbols = hotSymbols;
      } else if (interval === '5m') {
        const groupIdx = Math.floor(new Date().getMinutes() / 5) % 2;
        const warmToUpdate = warmSymbols.filter((_, idx) => idx % 2 === groupIdx);
        targetSymbols = [...hotSymbols, ...warmToUpdate];
      } else if (
        interval === '15m' ||
        interval === '1h' ||
        interval === '4h' ||
        interval === '1d'
      ) {
        targetSymbols = [...hotSymbols, ...warmSymbols];
      } else if (interval === '30m') {
        const groupIdx = Math.floor(new Date().getMinutes() / 30) % 2;
        const warmToUpdate = warmSymbols.filter((_, idx) => idx % 2 === groupIdx);
        targetSymbols = [...hotSymbols, ...warmToUpdate];
      } else if (interval === '2h') {
        const groupIdx = Math.floor(new Date().getHours() / 2) % 2;
        const warmToUpdate = warmSymbols.filter((_, idx) => idx % 2 === groupIdx);
        targetSymbols = [...hotSymbols, ...warmToUpdate];
      } else {
        // 1w, 1M: 長週期更新
        const warmToUpdate = warmSymbols.filter((_, idx) => idx % 2 === 0);
        targetSymbols = [...hotSymbols, ...warmToUpdate];
      }

      // 將任務加到佇列中，避免重複
      for (const symbol of targetSymbols) {
        const exists = this.queue.some((t) => t.symbol === symbol && t.interval === interval);
        if (!exists) {
          this.queue.push({ symbol, interval });
        }
      }

      const hotCount = getUniverseConfigFromEnv().hotCount;

      // 佇列排序：
      // 1. 優先處理所有熱門標的 (Hot Symbols, Volume Rank < hotCount)
      // 2. 同屬熱門或非熱門時，優先權高的 (時間短的時框，如 5m) 排在前面
      // 3. 同時框且同熱度屬性時，成交量排行較前面 (熱門幣種) 排在前面
      this.queue.sort((a, b) => {
        const isHotA = (this.symbolRankMap.get(a.symbol) ?? 9999) < hotCount;
        const isHotB = (this.symbolRankMap.get(b.symbol) ?? 9999) < hotCount;

        if (isHotA !== isHotB) {
          return isHotA ? -1 : 1;
        }

        const prioA = INTERVAL_PRIORITY[a.interval] || 99;
        const prioB = INTERVAL_PRIORITY[b.interval] || 99;
        if (prioA !== prioB) {
          return prioA - prioB;
        }

        const rankA = this.symbolRankMap.get(a.symbol) ?? 9999;
        const rankB = this.symbolRankMap.get(b.symbol) ?? 9999;
        return rankA - rankB;
      });

      // 只有在 startProcessor 為 true 時啟動佇列處理器
      if (startProcessor) {
        this.processQueue();
      }
    } catch (err: any) {
      this.logger.error(`Failed to enqueue klines for interval ${interval}`, err?.stack);
    }
  }

  /**
   * 佇列處理器：依序、單線程執行 API 請求，防範併發請求造成權重爆額
   */
  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) continue;

      try {
        const klines = await this.binanceService.getKlines(task.symbol, task.interval);
        await this.marketCacheService.setKlines(task.symbol, task.interval, klines);
      } catch (err: any) {
        this.logger.error(
          `Failed to fetch and cache klines for ${task.symbol} (${task.interval})`,
          err?.stack,
        );
      }

      // 自適應防爆延遲 (Used Weight Rate Limit Backoff)
      await this.adaptiveDelay();
    }

    this.isProcessing = false;
  }

  /**
   * 自適應延遲：依據 Binance 回傳的累積 API 權重，動態調控請求間隔
   */
  private async adaptiveDelay() {
    const weight = this.binanceService.getUsedWeight();
    let delay = 100; // 預設 100ms 延遲

    if (weight > 2200) {
      delay = 3000; // 逼近 2400 上限，延遲拉長至 3s
    } else if (weight > 1800) {
      delay = 1000; // 稍高，延遲 1s
    } else if (weight > 1000) {
      delay = 300; // 中等，延遲 300ms
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * 獲取當前佇列長度 (供測試與狀態監控使用)
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}
