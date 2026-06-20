import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BinanceService, VolumeRanking } from './binance.service';
import { MarketCacheService } from './market-cache.service';
import { BinanceWebsocketService } from './binance-websocket.service';

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

  constructor(
    private readonly binanceService: BinanceService,
    private readonly marketCacheService: MarketCacheService,
    private readonly binanceWebsocketService: BinanceWebsocketService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Market Schedule Service...');
    try {
      // 啟動時預先載入成交量排行與最新價格列表，以確保系統啟動後即有行情基礎資料
      const ranking = await this.updatePricesAndRanking();
      const symbols = await this.binanceService.getUSDTFuturesSymbols();

      // 啟動時預熱常用時框的 K 線快取
      if (ranking.length > 0 && symbols.length > 0) {
        this.logger.log('Warming up K-line caches on startup...');
        const warmupIntervals = ['5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w', '1M'];
        for (const interval of warmupIntervals) {
          // 傳入快取的 symbols 與 ranking，且設定 startProcessor = false，防範啟動時的競態條件
          await this.enqueueKlinesForInterval(interval, false, symbols, ranking);
        }
        // 統一在全部任務皆已入列並排好順序後，才一次性啟動處理器，確保完全遵守優先權排序
        this.processQueue();
      }
    } catch (err: any) {
      this.logger.error('Failed to run initial startup initialization', err?.stack);
    }
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
   * 依時間週期將需更新的交易對加入佇列，並針對 Cold 交易對進行模除分流行動
   */
  private async enqueueKlinesForInterval(
    interval: string,
    startProcessor = true,
    cachedSymbols?: string[],
    cachedRanking?: VolumeRanking[],
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

      // 建立成交量 Map，以便快速查詢與排序
      const volumeMap = new Map<string, number>();
      ranking.forEach((r) => volumeMap.set(r.symbol, r.quoteVolume));

      // 依交易量降冪排序
      symbols.sort((a, b) => {
        const volA = volumeMap.get(a) || 0;
        const volB = volumeMap.get(b) || 0;
        return volB - volA;
      });

      // 劃分熱門與冷門交易對 (熱門取前50)
      const hotSymbols = symbols.slice(0, 50);
      const coldSymbols = symbols.slice(50);

      let targetSymbols: string[] = [];

      // 實作熱度分流策略，冷門交易對依分鐘進行模除分流，以降低單次排程之 API 負載
      if (interval === '5m') {
        const groupIdx = Math.floor(new Date().getMinutes() / 5) % 3;
        const coldToUpdate = coldSymbols.filter((_, idx) => idx % 3 === groupIdx);
        targetSymbols = [...hotSymbols, ...coldToUpdate];
      } else if (interval === '15m') {
        const groupIdx = Math.floor(new Date().getMinutes() / 15) % 2;
        const coldToUpdate = coldSymbols.filter((_, idx) => idx % 2 === groupIdx);
        targetSymbols = [...hotSymbols, ...coldToUpdate];
      } else if (interval === '30m') {
        const groupIdx = Math.floor(new Date().getMinutes() / 30) % 2;
        const coldToUpdate = coldSymbols.filter((_, idx) => idx % 2 === groupIdx);
        targetSymbols = [...hotSymbols, ...coldToUpdate];
      } else {
        // 大於 30m 的長時框，每次排程皆更新所有交易對
        targetSymbols = symbols;
      }

      // 將任務加到佇列中，避免重複
      for (const symbol of targetSymbols) {
        const exists = this.queue.some((t) => t.symbol === symbol && t.interval === interval);
        if (!exists) {
          this.queue.push({ symbol, interval });
        }
      }

      // 佇列排序：
      // 1. 優先處理所有熱門標的 (Hot Symbols, Volume Rank < 50)
      // 2. 同屬熱門或冷門時，優先權高的 (時間短的時框，如 5m) 排在前面
      // 3. 同時框且同熱度屬性時，成交量排行較前面 (熱門幣種) 排在前面
      this.queue.sort((a, b) => {
        const isHotA = (this.symbolRankMap.get(a.symbol) ?? 9999) < 50;
        const isHotB = (this.symbolRankMap.get(b.symbol) ?? 9999) < 50;

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
