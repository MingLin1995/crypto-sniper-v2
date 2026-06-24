import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MarketCacheService } from './market-cache.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class BinanceWebsocketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceWebsocketService.name);
  private readonly wsUrl = 'wss://fstream.binance.com/market/ws/!ticker@arr';
  private readonly REDIS_ACTIVE_SYMBOLS_KEY = 'alerts:active_symbols';
  
  private ws: WebSocket | null = null;
  private reconnectTimeout: any = null;
  private reconnectDelay = 1000; // 初始重連延遲 1 秒
  private readonly maxReconnectDelay = 60000; // 最大重連延遲 60 秒
  
  private lastMessageTime = 0;
  private watchdogInterval: any = null;
  private syncInterval: any = null;
  
  // 記憶體快取：記錄當前有活躍告警的交易對
  private activeAlertSymbols = new Set<string>();

  constructor(
    private readonly marketCacheService: MarketCacheService,
    private readonly redisService: RedisService,
    @InjectQueue('price-check') private readonly priceCheckQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('Starting Binance WebSocket Service...');
    
    // 1. 立即同步一次活躍告警標的
    await this.syncActiveAlertSymbols();

    // 2. 定期每 5 秒從 Redis 同步活躍告警標的，以維護最新記憶體快取
    this.syncInterval = setInterval(() => {
      this.syncActiveAlertSymbols().catch((err) => {
        this.logger.error('Error syncing active alert symbols:', err);
      });
    }, 5000);

    // 3. 建立 WebSocket 連線
    this.connect();

    // 4. 啟動看門狗 (Watchdog) 監控連線，防範假連線 (Half-Open Connection)
    // 若 30 秒內沒收到任何行情更新，強制重連
    this.watchdogInterval = setInterval(() => {
      const now = Date.now();
      if (this.ws && now - this.lastMessageTime > 30000) {
        this.logger.warn('WebSocket watchdog timed out (no data for 30s). Reconnecting...');
        this.reconnect();
      }
    }, 10000);
  }

  onModuleDestroy() {
    this.logger.log('Shutting down Binance WebSocket Service...');
    
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 檢查 WebSocket 連線是否正常運作且有行情資料流量
   */
  isAlive(): boolean {
    return this.ws !== null && (Date.now() - this.lastMessageTime < 30000);
  }

  /**
   * 從 Redis 載入當前所有有活躍告警設定的交易對名稱
   */
  private async syncActiveAlertSymbols() {
    try {
      const symbols = await this.redisService.getClient().smembers(this.REDIS_ACTIVE_SYMBOLS_KEY);
      this.activeAlertSymbols = new Set(symbols.map((s) => s.toUpperCase()));
    } catch (err: any) {
      this.logger.error('Failed to sync active alert symbols from Redis Set:', err?.stack);
    }
  }

  /**
   * 建立 WebSocket 長連線
   */
  private connect() {
    this.logger.log(`Connecting to Binance Futures WebSocket: ${this.wsUrl}`);
    
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.lastMessageTime = Date.now();
    } catch (err: any) {
      this.logger.error('Failed to instantiate WebSocket client', err?.stack);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.logger.log('Binance Futures WebSocket connected successfully.');
      this.reconnectDelay = 1000; // 重置重連延遲
      this.lastMessageTime = Date.now();
    };

    this.ws.onmessage = (event) => {
      this.lastMessageTime = Date.now();
      this.handleMessage(event.data.toString());
    };

    this.ws.onerror = (err) => {
      this.logger.error('WebSocket error occurred:', err);
    };

    this.ws.onclose = (event) => {
      this.logger.warn(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      this.scheduleReconnect();
    };
  }

  /**
   * 處理接收到的行情行情資料
   */
  private async handleMessage(dataStr: string) {
    try {
      const parsed = JSON.parse(dataStr);
      if (!Array.isArray(parsed)) return;

      const pricesToCache: { symbol: string; price: number }[] = [];
      const symbolsToCheck: string[] = [];

      for (const item of parsed) {
        const symbol = item.s;
        const price = parseFloat(item.c);

        if (symbol && !isNaN(price)) {
          pricesToCache.push({ symbol, price });

          // 比對記憶體快取，若該交易對有活躍告警，將其納入 price-check 檢查名單
          if (this.activeAlertSymbols.has(symbol)) {
            symbolsToCheck.push(symbol);
          }
        }
      }

      // 1. 批次寫入 Redis 行情價格快取
      if (pricesToCache.length > 0) {
        await this.marketCacheService.setPricesPipeline(pricesToCache);
      }

      // 2. 異步推入 BullMQ 進行到價比對 (使用 jobId 做 Conflation，同一時間同一標的僅排入一個比對工作)
      for (const symbol of symbolsToCheck) {
        await this.priceCheckQueue.add(
          'check',
          { symbol },
          {
            jobId: `price-check-${symbol}`,
            // 由於價格是高頻變動，若佇列積壓，不需要重試太久之前的到價比對
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      }
    } catch (err: any) {
      this.logger.error('Failed to parse or process WebSocket message', err?.stack);
    }
  }

  /**
   * 排程重新連線 (指數退避策略)
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) return;

    this.logger.log(`Scheduling reconnect in ${this.reconnectDelay}ms...`);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
      // 指數退避延遲計算
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  /**
   * 強制關閉並立即重連 (清空事件處理器以防 onclose 被觸發導致重複 connect)
   */
  private reconnect() {
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch (err) {
        // Ignore
      }
      this.ws = null;
    }
    this.connect();
  }
}
