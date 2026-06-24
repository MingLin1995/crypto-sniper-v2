import { Test, TestingModule } from '@nestjs/testing';
import { WatchlistService } from './watchlist.service';
import { ExtendedPrismaService } from '../common/prisma/extended-prisma.service';
import { MarketCacheService } from '../market/market-cache.service';
import { BinanceService } from '../market/binance.service';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('WatchlistService', () => {
  let service: WatchlistService;
  let mockPrismaClient: any;
  let mockMarketCacheService: any;
  let mockBinanceService: any;

  beforeEach(async () => {
    mockPrismaClient = {
      watchlistItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockMarketCacheService = {
      getPrice: jest.fn(),
      getPrices: jest.fn(),
    };

    mockBinanceService = {
      getUSDTFuturesSymbols: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatchlistService,
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
          provide: BinanceService,
          useValue: mockBinanceService,
        },
      ],
    }).compile();

    service = module.get<WatchlistService>(WatchlistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('WatchlistService 應該被成功載入', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const userId = 'user-1';
    const dto = { symbol: 'BTCUSDT' };

    it('如果價格存在於快取中且尚未被追蹤，應成功建立追蹤', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(65000);
      mockPrismaClient.watchlistItem.findUnique.mockResolvedValue(null);
      mockPrismaClient.watchlistItem.create.mockResolvedValue({
        id: 'item-1',
        userId,
        symbol: 'BTCUSDT',
        createdAt: new Date(),
      });

      const result = await service.create(userId, dto);

      expect(mockMarketCacheService.getPrice).toHaveBeenCalledWith('BTCUSDT');
      expect(mockPrismaClient.watchlistItem.findUnique).toHaveBeenCalled();
      expect(mockPrismaClient.watchlistItem.create).toHaveBeenCalledWith({
        data: { userId, symbol: 'BTCUSDT' },
      });
      expect(result).toHaveProperty('id', 'item-1');
    });

    it('如果快取不存在，但 Binance 支援該交易對，應成功建立追蹤', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(null);
      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(['BTCUSDT', 'ETHUSDT']);
      mockPrismaClient.watchlistItem.findUnique.mockResolvedValue(null);
      mockPrismaClient.watchlistItem.create.mockResolvedValue({
        id: 'item-1',
        userId,
        symbol: 'BTCUSDT',
        createdAt: new Date(),
      });

      const result = await service.create(userId, dto);

      expect(mockMarketCacheService.getPrice).toHaveBeenCalledWith('BTCUSDT');
      expect(mockBinanceService.getUSDTFuturesSymbols).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'item-1');
    });

    it('如果標的不存在於快取也不在 Binance 列表中，應拋出 BadRequestException', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(null);
      mockBinanceService.getUSDTFuturesSymbols.mockResolvedValue(['ETHUSDT']);

      await expect(service.create(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('如果已在追蹤清單中，應拋出 ConflictException', async () => {
      mockMarketCacheService.getPrice.mockResolvedValue(65000);
      mockPrismaClient.watchlistItem.findUnique.mockResolvedValue({
        id: 'existing-id',
        userId,
        symbol: 'BTCUSDT',
      });

      await expect(service.create(userId, dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    const userId = 'user-1';

    it('應成功讀取追蹤清單並與快取價格合併', async () => {
      const mockItems = [
        { id: '1', symbol: 'BTCUSDT', createdAt: '2026-06-17T00:00:00Z' },
        { id: '2', symbol: 'ETHUSDT', createdAt: '2026-06-17T01:00:00Z' },
      ];
      mockPrismaClient.watchlistItem.findMany.mockResolvedValue(mockItems);
      mockMarketCacheService.getPrices.mockResolvedValue({
        BTCUSDT: 65000,
        ETHUSDT: null,
      });

      const result = await service.findAll(userId);

      expect(mockPrismaClient.watchlistItem.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockMarketCacheService.getPrices).toHaveBeenCalledWith(['BTCUSDT', 'ETHUSDT']);
      expect(result).toEqual([
        { id: '1', symbol: 'BTCUSDT', price: 65000, createdAt: '2026-06-17T00:00:00Z' },
        { id: '2', symbol: 'ETHUSDT', price: null, createdAt: '2026-06-17T01:00:00Z' },
      ]);
    });

    it('若清單為空應回傳空陣列', async () => {
      mockPrismaClient.watchlistItem.findMany.mockResolvedValue([]);

      const result = await service.findAll(userId);

      expect(result).toEqual([]);
      expect(mockMarketCacheService.getPrices).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const userId = 'user-1';
    const symbol = 'BTCUSDT';

    it('應成功刪除擁有權屬於自己的追蹤項目', async () => {
      mockPrismaClient.watchlistItem.findUnique.mockResolvedValue({
        id: 'item-1',
        userId,
        symbol: 'BTCUSDT',
      });
      mockPrismaClient.watchlistItem.delete.mockResolvedValue({});

      const result = await service.remove(userId, symbol);

      expect(mockPrismaClient.watchlistItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
      expect(result).toEqual({ message: '已成功移除追蹤' });
    });

    it('若追蹤不存在應拋出 NotFoundException', async () => {
      mockPrismaClient.watchlistItem.findUnique.mockResolvedValue(null);

      await expect(service.remove(userId, symbol)).rejects.toThrow(NotFoundException);
    });
  });
});
