import { Test, TestingModule } from '@nestjs/testing';
import { MarketScheduleService } from './market-schedule.service';
import { MarketCacheService } from './market-cache.service';
import { BinanceService } from './binance.service';
import { RedisService } from '../common/redis/redis.service';
import { BinanceWebsocketService } from './binance-websocket.service';

describe('MarketScheduleService & MarketCacheService', () => {
  let scheduleService: MarketScheduleService;
  let cacheService: MarketCacheService;
  let mockRedisClient: any;
  let mockRedisService: any;
  let mockBinanceService: any;

  beforeEach(async () => {
    // 模擬 Redis Pipeline
    const mockPipeline = {
      setex: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    // 模擬 Redis Client
    mockRedisClient = {
      get: jest.fn(),
      setex: jest.fn(),
      hset: jest.fn(),
      hget: jest.fn(),
      hmget: jest.fn(),
      expire: jest.fn(),
      pipeline: jest.fn().mockReturnValue(mockPipeline),
    };

    // 模擬 Redis Service
    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    // 模擬 Binance Service
    mockBinanceService = {
      getTickerPrices: jest.fn().mockResolvedValue([]),
      get24hVolumeRanking: jest.fn().mockResolvedValue([]),
      getUSDTFuturesSymbols: jest.fn().mockResolvedValue([]),
      getKlines: jest.fn().mockResolvedValue([]),
      getUsedWeight: jest.fn().mockReturnValue(0),
    };

    // 模擬 Binance Websocket Service
    const mockBinanceWebsocketService = {
      isAlive: jest.fn().mockReturnValue(false), // 預設為不活躍，以執行 Cron 的備援 REST 請求
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketCacheService,
        MarketScheduleService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: BinanceService,
          useValue: mockBinanceService,
        },
        {
          provide: BinanceWebsocketService,
          useValue: mockBinanceWebsocketService,
        },
      ],
    }).compile();

    scheduleService = module.get<MarketScheduleService>(MarketScheduleService);
    cacheService = module.get<MarketCacheService>(MarketCacheService);

    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('服務應該要被成功載入', () => {
    expect(scheduleService).toBeDefined();
    expect(cacheService).toBeDefined();
  });

  describe('MarketCacheService (快取功能測試)', () => {
    it('setPrice 應能寫入 Redis 且 TTL 為 30 秒', async () => {
      await cacheService.setPrice('BTCUSDT', 65000);
      expect(mockRedisClient.hset).toHaveBeenCalledWith('market:prices', 'BTCUSDT', '65000');
      expect(mockRedisClient.expire).toHaveBeenCalledWith('market:prices', 30);
    });

    it('getPrice 應能從 Redis 取得價格並轉為數值', async () => {
      mockRedisClient.hget.mockResolvedValue('65000.5');
      const price = await cacheService.getPrice('BTCUSDT');
      expect(mockRedisClient.hget).toHaveBeenCalledWith('market:prices', 'BTCUSDT');
      expect(price).toBe(65000.5);
    });

    it('setPricesPipeline 應使用 Redis HSET 寫入多筆成交價', async () => {
      const prices = [
        { symbol: 'BTCUSDT', price: 65000 },
        { symbol: 'ETHUSDT', price: 3500 },
      ];
      await cacheService.setPricesPipeline(prices);
      expect(mockRedisClient.hset).toHaveBeenCalledWith('market:prices', {
        BTCUSDT: '65000',
        ETHUSDT: '3500',
      });
      expect(mockRedisClient.expire).toHaveBeenCalledWith('market:prices', 30);
    });

    it('setKlines 應依時間週期計算對應 TTL 並存入緊湊格式 K 線資料 JSON 字串', async () => {
      const prices = [
        { open: 100, high: 100, low: 100, close: 100, volume: 0, openTime: 0, closeTime: 0 },
        { open: 101, high: 101, low: 101, close: 101, volume: 0, openTime: 0, closeTime: 0 },
        { open: 102, high: 102, low: 102, close: 102, volume: 0, openTime: 0, closeTime: 0 }
      ];
      const expectedCompact = prices.map(k => [k.openTime, k.open, k.high, k.low, k.close, k.volume, k.closeTime]);

      await cacheService.setKlines('BTCUSDT', '5m', prices);
      expect(mockRedisClient.setex).toHaveBeenCalledWith('market:klines:BTCUSDT:5m', 7200, JSON.stringify(expectedCompact));

      await cacheService.setKlines('BTCUSDT', '1d', prices);
      expect(mockRedisClient.setex).toHaveBeenCalledWith('market:klines:BTCUSDT:1d', 604800, JSON.stringify(expectedCompact));
    });

    it('getKlines 應能從 Redis 取得 K 線資料陣列', async () => {
      const prices = [
        { open: 100, high: 100, low: 100, close: 100, volume: 0, openTime: 0, closeTime: 0 },
        { open: 101, high: 101, low: 101, close: 101, volume: 0, openTime: 0, closeTime: 0 },
        { open: 102, high: 102, low: 102, close: 102, volume: 0, openTime: 0, closeTime: 0 }
      ];
      mockRedisClient.get.mockResolvedValue(JSON.stringify(prices));
      const result = await cacheService.getKlines('BTCUSDT', '5m');
      expect(mockRedisClient.get).toHaveBeenCalledWith('market:klines:BTCUSDT:5m');
      expect(result).toEqual(prices);
    });
  });

  describe('MarketScheduleService (排程與佇列調度測試)', () => {
    it('handleTickerPricesUpdate 應定期批次拉取價格並寫入 Redis', async () => {
      const mockPrices = [
        { symbol: 'BTCUSDT', price: 60000 },
        { symbol: 'ETHUSDT', price: 3000 },
      ];
      mockBinanceService.getTickerPrices.mockResolvedValue(mockPrices);

      await scheduleService.handleTickerPricesUpdate();

      expect(mockBinanceService.getTickerPrices).toHaveBeenCalled();
      expect(mockRedisClient.hset).toHaveBeenCalledWith('market:prices', {
        BTCUSDT: '60000',
        ETHUSDT: '3000',
      });
      expect(mockRedisClient.expire).toHaveBeenCalledWith('market:prices', 30);
    });

    it('分流策略：enqueueKlinesForInterval 應能區分 Hot 與 Cold 標的並進行模除分流', async () => {
      const mockSymbols = Array.from({ length: 60 }, (_, i) => `SYM${i}USDT`);
      const mockRanking = mockSymbols.map((symbol, idx) => ({
        symbol,
        quoteVolume: 100000 - idx * 1000,
      }));

      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(mockSymbols);
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRanking));
      mockBinanceService.getKlines.mockResolvedValue([
        { open: 100, high: 100, low: 100, close: 100, volume: 0, openTime: 0, closeTime: 0 },
        { open: 101, high: 101, low: 101, close: 101, volume: 0, openTime: 0, closeTime: 0 },
        { open: 102, high: 102, low: 102, close: 102, volume: 0, openTime: 0, closeTime: 0 }
      ]);

      const getMinutesSpy = jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(5);

      await scheduleService.handle5mKlines();

      const queueLength = scheduleService.getQueueLength();
      expect(queueLength).toBeGreaterThanOrEqual(50);
      expect(queueLength).toBeLessThan(60);

      getMinutesSpy.mockRestore();
    });

    it('自適應延遲：當 Used Weight 高時，應增加延遲間隔', async () => {
      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(['BTCUSDT']);
      mockRedisClient.get.mockResolvedValue(JSON.stringify([{ symbol: 'BTCUSDT', quoteVolume: 100000 }]));
      mockBinanceService.getKlines.mockResolvedValue([
        { open: 100, high: 100, low: 100, close: 100, volume: 0, openTime: 0, closeTime: 0 },
        { open: 101, high: 101, low: 101, close: 101, volume: 0, openTime: 0, closeTime: 0 }
      ]);

      mockBinanceService.getUsedWeight.mockReturnValue(0);
      await scheduleService.handle5mKlines();
      
      expect(mockBinanceService.getKlines).toHaveBeenCalledWith('BTCUSDT', '5m');

      mockBinanceService.getUsedWeight.mockReturnValue(2300);
      mockBinanceService.getKlines.mockClear();
      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(['ETHUSDT']);
      mockRedisClient.get.mockResolvedValue(JSON.stringify([{ symbol: 'ETHUSDT', quoteVolume: 100000 }]));
      
      const promise = scheduleService.handle5mKlines();
      jest.advanceTimersByTime(3000);
      await promise;
    });

    it('任務佇列排序：優先執行小時間時框 (優先權排序)', async () => {
      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(['BTCUSDT']);
      mockRedisClient.get.mockResolvedValue(JSON.stringify([{ symbol: 'BTCUSDT', quoteVolume: 100000 }]));
      mockBinanceService.getKlines.mockResolvedValue([
        { open: 100, high: 100, low: 100, close: 100, volume: 0, openTime: 0, closeTime: 0 }
      ]);

      // 先放入長時框 1M，再放入短時框 5m，以確保佇列排序正確
      await scheduleService.handle1MKlines();
      await scheduleService.handle5mKlines();

      const queue = (scheduleService as any).queue;
      if (queue.length > 0) {
        expect(queue[0].interval).toBe('5m');
      }
    });

    it('任務佇列排序：優先處理所有熱門標的跨時框，再處理冷門標的', async () => {
      const mockSymbols = ['BTCUSDT', 'COLDUSDT'];
      // 建立包含 50 個虛擬熱門標的的排行，將 COLDUSDT 擠出前 50 名之外，使其被判定為 Cold
      const mockRanking = [
        { symbol: 'BTCUSDT', quoteVolume: 100000 },
        ...Array.from({ length: 49 }, (_, i) => ({
          symbol: `HOT${i}USDT`,
          quoteVolume: 50000 - i * 100,
        })),
        { symbol: 'COLDUSDT', quoteVolume: 10 },
      ];

      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(mockSymbols);
      (scheduleService as any).symbolRankMap.set('BTCUSDT', 0);
      (scheduleService as any).symbolRankMap.set('COLDUSDT', 60);

      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockRanking));
      mockBinanceService.getKlines.mockResolvedValue([
        { open: 100, high: 100, low: 100, close: 100, volume: 0, openTime: 0, closeTime: 0 }
      ]);

      // 1. 先加入 COLDUSDT 的 5m 任務 (冷門 5m)
      (scheduleService as any).queue.push({ symbol: 'COLDUSDT', interval: '5m' });
      // 2. 觸發 BTCUSDT 的 1M 任務入列 (這會觸發重新排序)
      await scheduleService.handle1MKlines();

      const queue = (scheduleService as any).queue;
      
      const btcTaskIndex = queue.findIndex((t: any) => t.symbol === 'BTCUSDT' && t.interval === '1M');
      const coldTaskIndex = queue.findIndex((t: any) => t.symbol === 'COLDUSDT' && t.interval === '5m');
      
      expect(btcTaskIndex).toBeLessThan(coldTaskIndex);
    });
  });
});
