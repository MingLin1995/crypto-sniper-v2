import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from './alerts.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { BinanceService } from '../market/binance.service';
import { MarketCacheService } from '../market/market-cache.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('AlertsService', () => {
  let service: AlertsService;
  let mockPrismaClient: any;
  let mockRedisClient: any;
  let mockBinanceService: any;
  let mockMarketCacheService: any;

  beforeEach(async () => {
    mockPrismaClient = {
      priceAlert: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    mockRedisClient = {
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
    };

    mockBinanceService = {
      getUSDTFuturesSymbols: jest.fn(),
    };

    mockMarketCacheService = {
      getPrice: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: ExtendedPrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: () => mockRedisClient,
          },
        },
        {
          provide: BinanceService,
          useValue: mockBinanceService,
        },
        {
          provide: MarketCacheService,
          useValue: mockMarketCacheService,
        },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('AlertsService 應該被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const userId = 'user-1';
    const dto = { symbol: 'BTCUSDT', condition: 'ABOVE', targetPrice: 65000 };

    it('應成功建立價格告警並加入 Redis 活躍標的 Set', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(64000);
      mockPrismaClient.priceAlert.create.mockResolvedValue({
        id: 'alert-1',
        userId,
        symbol: 'BTCUSDT',
        condition: 'ABOVE',
        targetPrice: new Prisma.Decimal(65000),
        isActive: true,
        isTriggered: false,
      });

      const result = await service.create(userId, dto);

      expect(mockMarketCacheService.getPrice).toHaveBeenCalledWith('BTCUSDT');
      expect(mockPrismaClient.priceAlert.create).toHaveBeenCalled();
      expect(mockRedisClient.sadd).toHaveBeenCalledWith('alerts:active_symbols', 'BTCUSDT');
      expect(result).toHaveProperty('id', 'alert-1');
    });

    it('若標的無快取但 Binance 列表也不支援，應拋出 BadRequestException', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(null);
      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(['ETHUSDT']);

      await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('toggle', () => {
    const userId = 'user-1';
    const id = 'alert-1';

    it('應成功切換告警啟用狀態並更新 Redis', async () => {
      const mockAlert = { id, userId, symbol: 'BTCUSDT', isActive: true };
      mockPrismaClient.priceAlert.findFirst.mockResolvedValue(mockAlert);
      mockPrismaClient.priceAlert.update.mockResolvedValue({ ...mockAlert, isActive: false });
      mockPrismaClient.priceAlert.count.mockResolvedValue(0); // 剩餘活躍告警數為0

      const result = await service.toggle(userId, id);

      expect(mockPrismaClient.priceAlert.findFirst).toHaveBeenCalledWith({ where: { id, userId } });
      expect(mockPrismaClient.priceAlert.update).toHaveBeenCalledWith({
        where: { id },
        data: { isActive: false },
      });
      expect(mockRedisClient.srem).toHaveBeenCalledWith('alerts:active_symbols', 'BTCUSDT');
      expect(result.isActive).toBe(false);
    });

    it('若告警不存在應拋出 NotFoundException', async () => {
      mockPrismaClient.priceAlert.findFirst.mockResolvedValue(null);

      await expect(service.toggle(userId, id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const userId = 'user-1';
    const id = 'alert-1';

    it('應成功刪除告警並維護 Redis Set', async () => {
      const mockAlert = { id, userId, symbol: 'BTCUSDT' };
      mockPrismaClient.priceAlert.findFirst.mockResolvedValue(mockAlert);
      mockPrismaClient.priceAlert.delete.mockResolvedValue({});
      mockPrismaClient.priceAlert.count.mockResolvedValue(0);

      const result = await service.remove(userId, id);

      expect(mockPrismaClient.priceAlert.delete).toHaveBeenCalledWith({ where: { id } });
      expect(mockRedisClient.srem).toHaveBeenCalledWith('alerts:active_symbols', 'BTCUSDT');
      expect(result).toEqual({ message: '告警設定已刪除' });
    });
  });

  describe('syncActiveSymbols', () => {
    it('應載入所有活躍告警標的並同步至 Redis', async () => {
      const mockActiveAlerts = [{ symbol: 'BTCUSDT' }, { symbol: 'ETHUSDT' }, { symbol: 'BTCUSDT' }];
      mockPrismaClient.priceAlert.findMany.mockResolvedValue(mockActiveAlerts);

      await service.syncActiveSymbols();

      expect(mockPrismaClient.priceAlert.findMany).toHaveBeenCalled();
      expect(mockRedisClient.del).toHaveBeenCalledWith('alerts:active_symbols');
      expect(mockRedisClient.sadd).toHaveBeenCalledWith('alerts:active_symbols', 'BTCUSDT', 'ETHUSDT');
    });
  });
});
