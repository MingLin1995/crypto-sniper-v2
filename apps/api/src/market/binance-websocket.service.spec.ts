import { Test, TestingModule } from '@nestjs/testing';
import { BinanceWebsocketService } from './binance-websocket.service';
import { MarketCacheService } from './market-cache.service';
import { RedisService } from '../common/redis/redis.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('BinanceWebsocketService', () => {
  let service: BinanceWebsocketService;
  let mockMarketCacheService: any;
  let mockRedisClient: any;
  let mockQueue: any;
  let wsMockInstance: any;

  beforeAll(() => {
    // 模擬全域 WebSocket
    wsMockInstance = {
      close: jest.fn(),
      addEventListener: jest.fn(),
    };
    
    global.WebSocket = jest.fn().mockImplementation(() => wsMockInstance) as any;
  });

  beforeEach(async () => {
    mockMarketCacheService = {
      setPricesPipeline: jest.fn(),
    };

    mockRedisClient = {
      smembers: jest.fn().mockResolvedValue(['BTCUSDT']),
    };

    mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BinanceWebsocketService,
        {
          provide: MarketCacheService,
          useValue: mockMarketCacheService,
        },
        {
          provide: RedisService,
          useValue: {
            getClient: () => mockRedisClient,
          },
        },
        {
          provide: getQueueToken('price-check'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<BinanceWebsocketService>(BinanceWebsocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('BinanceWebsocketService 應該被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('handleMessage', () => {
    it('應成功解析行情訊息，更新 Redis 並為活躍標的推入 check queue', async () => {
      // 模擬活躍告警名單
      await (service as any).syncActiveAlertSymbols();
      expect(mockRedisClient.smembers).toHaveBeenCalledWith('alerts:active_symbols');

      // 模擬收到行情更新包，包含 BTCUSDT (活躍告警) 與 ETHUSDT (非活躍告警)
      const rawPayload = JSON.stringify([
        { s: 'BTCUSDT', c: '65200.00' },
        { s: 'ETHUSDT', c: '3500.00' },
      ]);

      await (service as any).handleMessage(rawPayload);

      // 應寫入 Redis 快取
      expect(mockMarketCacheService.setPricesPipeline).toHaveBeenCalledWith([
        { symbol: 'BTCUSDT', price: 65200 },
        { symbol: 'ETHUSDT', price: 3500 },
      ]);

      // 應僅推入 BTCUSDT 到到價比對佇列
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'check',
        { symbol: 'BTCUSDT' },
        expect.objectContaining({ jobId: 'price-check-BTCUSDT' }),
      );
    });
  });
});
