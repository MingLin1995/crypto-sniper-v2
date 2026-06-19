import { Test, TestingModule } from '@nestjs/testing';
import { PriceCheckProcessor } from './price-check.processor';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { MarketCacheService } from '../market/market-cache.service';
import { AlertsService } from './alerts.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';

describe('PriceCheckProcessor', () => {
  let processor: PriceCheckProcessor;
  let mockPrismaClient: any;
  let mockMarketCacheService: any;
  let mockAlertsService: any;
  let mockNotificationQueue: any;

  beforeEach(async () => {
    mockPrismaClient = {
      priceAlert: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    mockMarketCacheService = {
      getPrice: jest.fn(),
    };

    mockAlertsService = {
      updateRedisSymbolStatus: jest.fn(),
    };

    mockNotificationQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceCheckProcessor,
        {
          provide: ExtendedPrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
        {
          provide: MarketCacheService,
          useValue: mockMarketCacheService,
        },
        {
          provide: AlertsService,
          useValue: mockAlertsService,
        },
        {
          provide: getQueueToken('notification'),
          useValue: mockNotificationQueue,
        },
      ],
    }).compile();

    processor = module.get<PriceCheckProcessor>(PriceCheckProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('PriceCheckProcessor 應該被成功載入', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    const mockJob = {
      data: { symbol: 'BTCUSDT' },
    } as Job;

    it('如果沒有快取價格，應直接跳過比對', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(null);

      await processor.process(mockJob);

      expect(mockMarketCacheService.getPrice).toHaveBeenCalledWith('BTCUSDT');
      expect(mockPrismaClient.priceAlert.findMany).not.toHaveBeenCalled();
    });

    it('如果沒有活躍的告警設定，應跳過比對', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(65000);
      mockPrismaClient.priceAlert.findMany.mockResolvedValue([]);

      await processor.process(mockJob);

      expect(mockPrismaClient.priceAlert.findMany).toHaveBeenCalled();
      expect(mockPrismaClient.priceAlert.update).not.toHaveBeenCalled();
    });

    it('如果價格達到 ABOVE 告警目標，應觸發告警並推入通知佇列', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(65100);
      const mockAlerts = [
        {
          id: 'alert-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          condition: 'ABOVE',
          targetPrice: new Prisma.Decimal(65000),
          isActive: true,
          isTriggered: false,
        },
      ];
      mockPrismaClient.priceAlert.findMany.mockResolvedValue(mockAlerts);
      mockPrismaClient.priceAlert.update.mockResolvedValue({});

      await processor.process(mockJob);

      expect(mockPrismaClient.priceAlert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: expect.objectContaining({
          isActive: false,
          isTriggered: true,
          triggeredAt: expect.any(Date),
        }),
      });
      expect(mockNotificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        expect.objectContaining({
          alertId: 'alert-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          condition: 'ABOVE',
          targetPrice: 65000,
          triggeredPrice: 65100,
        }),
        expect.any(Object),
      );
      expect(mockAlertsService.updateRedisSymbolStatus).toHaveBeenCalledWith('BTCUSDT');
    });

    it('如果價格未達到 BELOW 告警目標，不應觸發告警', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(65100);
      const mockAlerts = [
        {
          id: 'alert-1',
          userId: 'user-1',
          symbol: 'BTCUSDT',
          condition: 'BELOW',
          targetPrice: new Prisma.Decimal(64000),
          isActive: true,
          isTriggered: false,
        },
      ];
      mockPrismaClient.priceAlert.findMany.mockResolvedValue(mockAlerts);

      await processor.process(mockJob);

      expect(mockPrismaClient.priceAlert.update).not.toHaveBeenCalled();
      expect(mockNotificationQueue.add).not.toHaveBeenCalled();
    });
  });
});
